package imguploader

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"time"

	"cloud.google.com/go/storage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
	"golang.org/x/oauth2/google"
)

const (
	tokenUrl         string = "https://www.googleapis.com/auth/devstorage.read_write" // #nosec
	uploadUrl        string = "https://www.googleapis.com/upload/storage/v1/b/%s/o?uploadType=media&name=%s"
	publicReadOption string = "&predefinedAcl=publicRead"
)

type GCSUploader struct {
	keyFile             string
	bucket              string
	path                string
	log                 log.Logger
	enableSignedUrls    bool
	signedUrlExpiration time.Duration
}

func NewGCSUploader(keyFile, bucket, path string, enableSignedUrls bool, signedUrlExpiration string) (*GCSUploader, error) {
	expiration, err := time.ParseDuration(signedUrlExpiration)
	if err != nil {
		return nil, err
	}
	if expiration <= 0 {
		return nil, fmt.Errorf("invalid signed url expiration: %q", expiration)
	}
	return &GCSUploader{
		keyFile:             keyFile,
		bucket:              bucket,
		path:                path,
		log:                 log.New("gcsuploader"),
		enableSignedUrls:    enableSignedUrls,
		signedUrlExpiration: expiration,
	}, nil
}

func (u *GCSUploader) Upload(ctx context.Context, imageDiskPath string) (string, error) {
	fileName, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}

	fileName += pngExt
	key := path.Join(u.path, fileName)

	var client *http.Client

	if u.keyFile != "" {
		u.log.Debug("Opening key file ", u.keyFile)
		data, err := ioutil.ReadFile(u.keyFile)
		if err != nil {
			return "", err
		}

		u.log.Debug("Creating JWT conf")
		conf, err := google.JWTConfigFromJSON(data, tokenUrl)
		if err != nil {
			return "", err
		}

		u.log.Debug("Creating HTTP client")
		client = conf.Client(ctx)
	} else {
		u.log.Debug("Key file is empty, trying to use application default credentials")
		client, err = google.DefaultClient(ctx)
		if err != nil {
			return "", err
		}
	}

	err = u.uploadFile(client, imageDiskPath, key)
	if err != nil {
		return "", err
	}

	if !u.enableSignedUrls {
		return fmt.Sprintf("https://storage.googleapis.com/%s/%s", u.bucket, key), nil
	}

	u.log.Debug("Signing GCS URL")
	jsonKey, err := ioutil.ReadFile(u.keyFile)
	if err != nil {
		return "", fmt.Errorf("ioutil.ReadFile: %v", err)
	}
	conf, err := google.JWTConfigFromJSON(jsonKey)
	if err != nil {
		return "", fmt.Errorf("google.JWTConfigFromJSON: %v", err)
	}
	opts := &storage.SignedURLOptions{
		Scheme:         storage.SigningSchemeV4,
		Method:         "GET",
		GoogleAccessID: conf.Email,
		PrivateKey:     conf.PrivateKey,
		Expires:        time.Now().Add(15 * time.Minute),
	}
	signedUrl, err := storage.SignedURL(u.bucket, key, opts)
	if err != nil {
		return "", fmt.Errorf("storage.SignedURL: %v", err)
	}
	return signedUrl, nil
}

func (u *GCSUploader) uploadFile(client *http.Client, imageDiskPath, key string) error {
	u.log.Debug("Opening image file ", imageDiskPath)

	fileReader, err := os.Open(imageDiskPath)
	if err != nil {
		return err
	}
	defer fileReader.Close()

	reqUrl := fmt.Sprintf(uploadUrl, u.bucket, key)
	if !u.enableSignedUrls {
		reqUrl += publicReadOption
	}
	u.log.Debug("Request URL: ", reqUrl)

	req, err := http.NewRequest("POST", reqUrl, fileReader)
	if err != nil {
		return err
	}

	req.Header.Add("Content-Type", "image/png")
	u.log.Debug("Sending POST request to GCS")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("GCS response status code %d", resp.StatusCode)
	}

	return nil
}

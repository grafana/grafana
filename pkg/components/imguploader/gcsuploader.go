package imguploader

import (
	"context"
	"fmt"
	"golang.org/x/oauth2/jwt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"time"

	"cloud.google.com/go/storage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
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
	uploader := &GCSUploader{
		keyFile:             keyFile,
		bucket:              bucket,
		path:                path,
		log:                 log.New("gcsuploader"),
		enableSignedUrls:    enableSignedUrls,
		signedUrlExpiration: expiration,
	}

	uploader.log.Debug(fmt.Sprintf("Created GCSUploader key=%q bucket=%q path=%q, enable_signed_urls=%v signed_url_expiration=%q", keyFile, bucket, path, enableSignedUrls, expiration.String()))

	return uploader, nil
}

func (u *GCSUploader) Upload(ctx context.Context, imageDiskPath string) (string, error) {
	fileName, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}

	fileName += pngExt
	key := path.Join(u.path, fileName)

	var client *storage.Client
	if u.keyFile != "" {
		u.log.Debug("Opening key file ", u.keyFile)
		data, err := ioutil.ReadFile(u.keyFile)
		if err != nil {
			return "", err
		}

		u.log.Debug("Creating Google credentials from JSON")
		creds, err := google.CredentialsFromJSON(ctx, data)
		if err != nil {
			return "", err
		}

		u.log.Debug("Creating GCS client")
		client, err = storage.NewClient(ctx, option.WithCredentials(creds))
		if err != nil {
			return "", err
		}
	} else {
		u.log.Debug("Creating GCS client with default application credentials")
		client, err = storage.NewClient(ctx)
		if err != nil {
			return "", err
		}
	}

	err = u.uploadFile(ctx, client, imageDiskPath, key)

	if !u.enableSignedUrls {
		return fmt.Sprintf("https://storage.googleapis.com/%s/%s", u.bucket, key), nil
	}

	u.log.Debug("Signing GCS URL")
	var conf *jwt.Config
	if u.keyFile != "" {
		jsonKey, err := ioutil.ReadFile(u.keyFile)
		if err != nil {
			return "", fmt.Errorf("ioutil.ReadFile: %v", err)
		}
		conf, err = google.JWTConfigFromJSON(jsonKey)
		if err != nil {
			return "", fmt.Errorf("google.JWTConfigFromJSON: %v", err)
		}
	} else {
		creds, err := google.FindDefaultCredentials(ctx, storage.ScopeReadWrite)
		if err != nil {
			return "", fmt.Errorf("google.FindDefaultCredentials: %v", err)
		}
		conf, err = google.JWTConfigFromJSON(creds.JSON)
		if err != nil {
			return "", fmt.Errorf("google.JWTConfigFromJSON: %v", err)
		}
	}
	opts := &storage.SignedURLOptions{
		Scheme:         storage.SigningSchemeV4,
		Method:         "GET",
		GoogleAccessID: conf.Email,
		PrivateKey:     conf.PrivateKey,
		Expires:        time.Now().Add(u.signedUrlExpiration),
	}
	signedUrl, err := storage.SignedURL(u.bucket, key, opts)
	if err != nil {
		return "", fmt.Errorf("storage.SignedURL: %v", err)
	}
	return signedUrl, nil
}

func (u *GCSUploader) uploadFile(
	ctx context.Context,
	client *storage.Client,
	imageDiskPath,
	key string,
) error {
	u.log.Debug("Opening image file ", imageDiskPath)

	fileReader, err := os.Open(imageDiskPath)
	if err != nil {
		return err
	}
	defer fileReader.Close()

	u.log.Debug("Sending to GCS bucket using SDK")
	wc := client.Bucket(u.bucket).Object(key).NewWriter(ctx)
	if _, err := io.Copy(wc, fileReader); err != nil {
		return err
	}
	if err := wc.Close(); err != nil {
		return err
	}

	return nil
}

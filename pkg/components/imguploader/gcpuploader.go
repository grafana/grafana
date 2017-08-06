package imguploader

import (
	"context"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
	"golang.org/x/oauth2/google"
	"io/ioutil"
	"net/http"
	"os"
)

type GCSUploader struct {
	keyFile string
	bucket  string
	log     log.Logger
}

func NewGCSUploader(keyFile, bucket string) *GCSUploader {
	return &GCSUploader{
		keyFile: keyFile,
		bucket:  bucket,
		log:     log.New("gcsuploader"),
	}
}

func (u *GCSUploader) Upload(imageDiskPath string) (string, error) {
	key := util.GetRandomString(20) + ".png"

	log.Debug("Opening key file ", u.keyFile)

	ctx := context.Background()
	data, err := ioutil.ReadFile(u.keyFile)
	if err != nil {
		return "", err
	}

	log.Debug("Creating JWT conf")

	conf, err := google.JWTConfigFromJSON(data, "https://www.googleapis.com/auth/devstorage.full_control")
	if err != nil {
		return "", err
	}

	log.Debug("Creating HTTP client")

	client := conf.Client(ctx)

	err = u.uploadFile(client, imageDiskPath, key)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("https://storage.googleapis.com/%s/%s", u.bucket, key), nil
}

func (u *GCSUploader) uploadFile(client *http.Client, imageDiskPath, key string) error {
	log.Debug("Opening image file ", imageDiskPath)

	fileReader, err := os.Open(imageDiskPath)
	if err != nil {
		return err
	}

	reqUrl := fmt.Sprintf(
		"https://www.googleapis.com/upload/storage/v1/b/%s/o?uploadType=media&name=%s&predefinedAcl=publicRead",
		u.bucket,
		key,
	)

	log.Debug("Request URL: ", reqUrl)

	req, err := http.NewRequest("POST", reqUrl, fileReader)
	if err != nil {
		return err
	}

	req.Header.Add("Content-Type", "image/png")

	log.Debug("Sending POST request to GCS")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}

	log.Debug("GCS API response header", resp.Header)

	if resp.StatusCode != 200 {
		return errors.New(fmt.Sprintf("GCS response status code %d", resp.StatusCode))
	}

	return nil
}

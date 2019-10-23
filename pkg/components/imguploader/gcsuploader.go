package imguploader

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
	"golang.org/x/oauth2/google"
)

const (
	tokenUrl  string = "https://www.googleapis.com/auth/devstorage.read_write" // #nosec
	uploadUrl string = "https://www.googleapis.com/upload/storage/v1/b/%s/o?uploadType=media&name=%s&predefinedAcl=publicRead"
)

type GCSUploader struct {
	keyFile string
	bucket  string
	path    string
	log     log.Logger
}

func NewGCSUploader(keyFile, bucket, path string) *GCSUploader {
	return &GCSUploader{
		keyFile: keyFile,
		bucket:  bucket,
		path:    path,
		log:     log.New("gcsuploader"),
	}
}

func (u *GCSUploader) Upload(ctx context.Context, imageDiskPath string) (string, error) {
	fileName, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}

	fileName += pngExt
	key := path.Join(u.path, fileName)

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
	client := conf.Client(ctx)
	err = u.uploadFile(client, imageDiskPath, key)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("https://storage.googleapis.com/%s/%s", u.bucket, key), nil
}

func (u *GCSUploader) uploadFile(client *http.Client, imageDiskPath, key string) error {
	u.log.Debug("Opening image file ", imageDiskPath)

	fileReader, err := os.Open(imageDiskPath)
	if err != nil {
		return err
	}
	defer fileReader.Close()

	reqUrl := fmt.Sprintf(uploadUrl, u.bucket, key)
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

	if resp.StatusCode != 200 {
		return fmt.Errorf("GCS response status code %d", resp.StatusCode)
	}

	return nil
}

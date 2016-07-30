package imguploader

import (
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
	"github.com/kr/s3/s3util"
)

type Uploader interface {
	Upload(path string) (string, error)
}

type S3Uploader struct {
	bucket    string
	secretKey string
	accessKey string
}

func NewS3Uploader(bucket, accessKey, secretKey string) *S3Uploader {
	return &S3Uploader{
		bucket:    bucket,
		accessKey: accessKey,
		secretKey: secretKey,
	}
}

func (u *S3Uploader) Upload(path string) (string, error) {

	s3util.DefaultConfig.AccessKey = u.accessKey
	s3util.DefaultConfig.SecretKey = u.secretKey
	log.Info("AccessKey: %s", u.accessKey)
	log.Info("SecretKey: %s", u.secretKey)

	header := make(http.Header)
	header.Add("x-amz-acl", "public-read")
	header.Add("Content-Type", "image/png")

	fullUrl := u.bucket + util.GetRandomString(20) + ".png"
	writer, err := s3util.Create(fullUrl, header, nil)
	if err != nil {
		return "", err
	}

	defer writer.Close()

	imgData, err := ioutil.ReadFile(path)
	if err != nil {
		return "", err
	}

	_, err = writer.Write(imgData)
	if err != nil {
		return "", err
	}

	return fullUrl, nil
}

package imguploader

import (
	"io/ioutil"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
	"github.com/kr/s3/s3util"
)

type S3Uploader struct {
	bucket    string
	secretKey string
	accessKey string
	log       log.Logger
}

func NewS3Uploader(bucket, accessKey, secretKey string) *S3Uploader {
	return &S3Uploader{
		bucket:    bucket,
		accessKey: accessKey,
		secretKey: secretKey,
		log:       log.New("s3uploader"),
	}
}

func (u *S3Uploader) Upload(imageDiskPath string) (string, error) {

	s3util.DefaultConfig.AccessKey = u.accessKey
	s3util.DefaultConfig.SecretKey = u.secretKey

	header := make(http.Header)
	header.Add("x-amz-acl", "public-read")
	header.Add("Content-Type", "image/png")

	var imageUrl *url.URL
	var err error

	if imageUrl, err = url.Parse(u.bucket); err != nil {
		return "", err
	}

	// add image to url
	imageUrl.Path = path.Join(imageUrl.Path, util.GetRandomString(20)+".png")
	imageUrlString := imageUrl.String()
	log.Debug("Uploading image to s3", "url", imageUrlString)

	writer, err := s3util.Create(imageUrlString, header, nil)
	if err != nil {
		return "", err
	}

	defer writer.Close()

	imgData, err := ioutil.ReadFile(imageDiskPath)
	if err != nil {
		return "", err
	}

	_, err = writer.Write(imgData)
	if err != nil {
		return "", err
	}

	return imageUrlString, nil
}

package imguploader

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/setting"
)

type ImageUploader interface {
	Upload(path string) (string, error)
}

type NopImageUploader struct {
}

func (NopImageUploader) Upload(path string) (string, error) {
	return "", nil
}

func NewImageUploader() (ImageUploader, error) {

	switch setting.ImageUploadProvider {
	case "s3":
		s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
		if err != nil {
			return nil, err
		}

		bucket := s3sec.Key("bucket_url").MustString("")
		accessKey := s3sec.Key("access_key").MustString("")
		secretKey := s3sec.Key("secret_key").MustString("")

		region := ""
		rBucket := regexp.MustCompile(`https?:\/\/(.*)\.s3(-([^.]+))?\.amazonaws\.com\/?`)
		matches := rBucket.FindStringSubmatch(bucket)
		if len(matches) == 0 {
			return nil, fmt.Errorf("Could not find bucket setting for image.uploader.s3")
		} else {
			bucket = matches[1]
			if matches[3] != "" {
				region = matches[3]
			} else {
				region = "us-east-1"
			}
		}

		return NewS3Uploader(region, bucket, "public-read", accessKey, secretKey), nil
	case "webdav":
		webdavSec, err := setting.Cfg.GetSection("external_image_storage.webdav")
		if err != nil {
			return nil, err
		}

		url := webdavSec.Key("url").String()
		if url == "" {
			return nil, fmt.Errorf("Could not find url key for image.uploader.webdav")
		}

		username := webdavSec.Key("username").String()
		password := webdavSec.Key("password").String()

		return NewWebdavImageUploader(url, username, password)
	}

	return NopImageUploader{}, nil
}

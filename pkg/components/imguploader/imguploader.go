package imguploader

import (
	"fmt"
	"time"

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

		region := s3sec.Key("region").MustString("")
		bucket := s3sec.Key("bucket_url").MustString("")
		acl := s3sec.Key("acl").MustString("")
		expires := s3sec.Key("expires").MustString("")
		accessKey := s3sec.Key("access_key").MustString("")
		secretKey := s3sec.Key("secret_key").MustString("")

		if region == "" {
			return nil, fmt.Errorf("Could not find region setting for image.uploader.s3")
		}

		if bucket == "" {
			return nil, fmt.Errorf("Could not find bucket setting for image.uploader.s3")
		}

		if acl == "" {
			return nil, fmt.Errorf("Could not find acl setting for image.uploader.s3")
		}

		if acl != "public-read" && acl != "public-read-write" {
			if _, err := time.ParseDuration(expires); err != nil {
				return nil, fmt.Errorf("Could not find valid expires setting for image.uploader.s3")
			}
		}

		return NewS3Uploader(region, bucket, acl, expires, accessKey, secretKey), nil
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

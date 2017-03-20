package imguploader

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/setting"
	"strings"
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

		bucketUrl := s3sec.Key("bucket_url").MustString("")
		accessKey := s3sec.Key("access_key").MustString("")
		secretKey := s3sec.Key("secret_key").MustString("")
		region := s3sec.Key("region").MustString("us-east-1")
		disableSsl := s3sec.Key("disable_ssl").MustBool(false)

		bucket := ""
		endpoint := "https://s3.amazonaws.com"
		if strings.Contains(bucketUrl, "amazonaws.com") {
			rBucket := regexp.MustCompile(`https?:\/\/(.*)\.s3(-([^.]+))?\.amazonaws\.com\/?`)
			matches := rBucket.FindStringSubmatch(bucketUrl)
			if len(matches) == 0 {
				return nil, fmt.Errorf("Could not find bucket setting for image.uploader.s3")
			} else {
				bucket = matches[1]
				if matches[3] != "" {
					region = matches[3]
				}
			}
		} else {
			rBucket := regexp.MustCompile(`^(https?://)([\w.]+\.[a-z]{2,}\.?)(/[\w.]*)*/?$`)
			matches := rBucket.FindStringSubmatch(bucketUrl)
			if len(matches) == 0 {
				return nil, fmt.Errorf("Could not find bucket setting for image.uploader.s3")
			}
			protocol := matches[1]
			domain := matches[2]
			slug := matches[3]
			if slug == "" {
				domainParts := strings.Split(domain, ".")
				bucket = domainParts[0]
				domain = strings.Replace(domain, bucket+".", "", -1)
			} else {
				bucket = strings.Replace(slug, "/", "", -1)
			}
			endpoint = protocol + domain

		}
		publicUrl := s3sec.Key("public_url").MustString(endpoint + "/" + bucket)

		return NewS3Uploader(region, endpoint, publicUrl, bucket, "public-read", accessKey, secretKey, disableSsl), nil
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

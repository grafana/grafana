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

		bucketUrl := s3sec.Key("bucket_url").MustString("")
		accessKey := s3sec.Key("access_key").MustString("")
		secretKey := s3sec.Key("secret_key").MustString("")
		info, err := getRegionAndBucketFromUrl(bucketUrl)
		if err != nil {
			return nil, err
		}

		return NewS3Uploader(info.region, info.bucket, "public-read", accessKey, secretKey), nil
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

type s3Info struct {
	region string
	bucket string
}

func getRegionAndBucketFromUrl(url string) (*s3Info, error) {
	info := &s3Info{}
	urlRegex := regexp.MustCompile(`https?:\/\/(.*)\.s3(-([^.]+))?\.amazonaws\.com\/?`)
	matches := urlRegex.FindStringSubmatch(url)
	if len(matches) > 0 {
		info.bucket = matches[1]
		if matches[3] != "" {
			info.region = matches[3]
		} else {
			info.region = "us-east-1"
		}
		return info, nil
	}

	urlRegex2 := regexp.MustCompile(`https?:\/\/s3(-([^.]+))?\.amazonaws\.com\/(.*)?`)
	matches2 := urlRegex2.FindStringSubmatch(url)
	if len(matches2) > 0 {
		info.bucket = matches2[3]
		if matches2[2] != "" {
			info.region = matches2[2]
		} else {
			info.region = "us-east-1"
		}
		return info, nil
	}

	return nil, fmt.Errorf("Could not find bucket setting for image.uploader.s3")
}

package imguploader

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/grafana/grafana/pkg/components/imguploader/gcs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	pngExt                        = ".png"
	defaultGCSSignedURLExpiration = 7 * 24 * time.Hour // 7 days
)

//go:generate mockgen -destination=mock.go -package=imguploader github.com/grafana/grafana/pkg/components/imguploader ImageUploader
type ImageUploader interface {
	Upload(ctx context.Context, path string) (string, error)
}

type NopImageUploader struct {
}

func (NopImageUploader) Upload(ctx context.Context, path string) (string, error) {
	return "", nil
}

var (
	logger = log.New("imguploader")
)

func NewImageUploader(cfg *setting.Cfg) (ImageUploader, error) {
	switch cfg.ImageUploadProvider {
	case "s3":
		s3sec, err := cfg.Raw.GetSection("external_image_storage.s3")
		if err != nil {
			return nil, err
		}

		endpoint := s3sec.Key("endpoint").MustString("")
		pathStyleAccess := s3sec.Key("path_style_access").MustBool(false)
		bucket := s3sec.Key("bucket").MustString("")
		region := s3sec.Key("region").MustString("")
		path := s3sec.Key("path").MustString("")
		bucketUrl := s3sec.Key("bucket_url").MustString("")
		accessKey := s3sec.Key("access_key").MustString("")
		secretKey := s3sec.Key("secret_key").MustString("")

		if path != "" && path[len(path)-1:] != "/" {
			path += "/"
		}

		if bucket == "" || region == "" {
			info, err := getRegionAndBucketFromUrl(bucketUrl)
			if err != nil {
				return nil, err
			}
			bucket = info.bucket
			region = info.region
		}

		return NewS3Uploader(endpoint, region, bucket, path, "public-read", accessKey, secretKey, pathStyleAccess), nil
	case "webdav":
		webdavSec, err := cfg.Raw.GetSection("external_image_storage.webdav")
		if err != nil {
			return nil, err
		}

		url := webdavSec.Key("url").String()
		if url == "" {
			return nil, fmt.Errorf("could not find URL key for image.uploader.webdav")
		}

		public_url := webdavSec.Key("public_url").String()
		username := webdavSec.Key("username").String()
		password := webdavSec.Key("password").String()

		return NewWebdavImageUploader(url, username, password, public_url)
	case "gcs":
		gcssec, err := cfg.Raw.GetSection("external_image_storage.gcs")
		if err != nil {
			return nil, err
		}

		keyFile := gcssec.Key("key_file").MustString("")
		bucketName := gcssec.Key("bucket").MustString("")
		path := gcssec.Key("path").MustString("")
		enableSignedURLs := gcssec.Key("enable_signed_urls").MustBool(false)
		exp := gcssec.Key("signed_url_expiration").MustString("")
		var suExp time.Duration
		if exp != "" {
			suExp, err = time.ParseDuration(exp)
			if err != nil {
				return nil, err
			}
		} else {
			suExp = defaultGCSSignedURLExpiration
		}

		return gcs.NewUploader(keyFile, bucketName, path, enableSignedURLs, suExp)
	case "azure_blob":
		azureBlobSec, err := cfg.Raw.GetSection("external_image_storage.azure_blob")
		if err != nil {
			return nil, err
		}

		account_name := azureBlobSec.Key("account_name").MustString("")
		account_key := azureBlobSec.Key("account_key").MustString("")
		container_name := azureBlobSec.Key("container_name").MustString("")
		sas_token_expiration_days := azureBlobSec.Key("sas_token_expiration_days").MustInt(-1)

		return NewAzureBlobUploader(account_name, account_key, container_name, sas_token_expiration_days), nil

	case "local":
		return NewLocalImageUploader()
	}

	if cfg.ImageUploadProvider != "" {
		logger.Error("The external image storage configuration is invalid", "unsupported provider", cfg.ImageUploadProvider)
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

	return nil, fmt.Errorf("could not find bucket setting for image.uploader.s3")
}

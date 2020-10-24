package imguploader

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"time"

	"golang.org/x/oauth2/jwt"

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
	enableSignedURLs    bool
	signedURLExpiration time.Duration
}

func NewGCSUploader(keyFile, bucket, path string, enableSignedURLs bool, signedURLExpiration string) (*GCSUploader, error) {
	expiration, err := time.ParseDuration(signedURLExpiration)
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
		enableSignedURLs:    enableSignedURLs,
		signedURLExpiration: expiration,
	}

	uploader.log.Debug("Created GCSUploader", "key", keyFile, "bucket", bucket, "path", path, "enableSignedUrls",
		enableSignedURLs, "signedUrlExpiration", expiration.String())

	return uploader, nil
}

func (u *GCSUploader) Upload(ctx context.Context, imageDiskPath string) (string, error) {
	fileName, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}

	fileName += pngExt
	key := path.Join(u.path, fileName)

	var keyData []byte
	if u.keyFile != "" {
		u.log.Debug("Opening key file ", u.keyFile)
		keyData, err = ioutil.ReadFile(u.keyFile)
		if err != nil {
			return "", err
		}
	}

	const scope = storage.ScopeReadWrite

	var client *storage.Client
	if u.keyFile != "" {
		u.log.Debug("Creating Google credentials from JSON")
		creds, err := google.CredentialsFromJSON(ctx, keyData, scope)
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
		client, err = storage.NewClient(ctx, option.WithScopes(scope))
		if err != nil {
			return "", err
		}
	}

	if err := u.uploadFile(ctx, client, imageDiskPath, key); err != nil {
		return "", err
	}

	if !u.enableSignedURLs {
		return fmt.Sprintf("https://storage.googleapis.com/%s/%s", u.bucket, key), nil
	}

	u.log.Debug("Signing GCS URL")
	var conf *jwt.Config
	if u.keyFile != "" {
		conf, err = google.JWTConfigFromJSON(keyData)
		if err != nil {
			return "", err
		}
	} else {
		creds, err := google.FindDefaultCredentials(ctx, scope)
		if err != nil {
			return "", fmt.Errorf("failed to find default Google credentials: %s", err)
		}
		conf, err = google.JWTConfigFromJSON(creds.JSON)
		if err != nil {
			return "", err
		}
	}
	opts := &storage.SignedURLOptions{
		Scheme:         storage.SigningSchemeV4,
		Method:         "GET",
		GoogleAccessID: conf.Email,
		PrivateKey:     conf.PrivateKey,
		Expires:        time.Now().Add(u.signedURLExpiration),
	}
	signedURL, err := storage.SignedURL(u.bucket, key, opts)
	if err != nil {
		return "", err
	}

	return signedURL, nil
}

func (u *GCSUploader) uploadFile(
	ctx context.Context,
	client *storage.Client,
	imageDiskPath,
	key string,
) error {
	u.log.Debug("Opening image file", "path", imageDiskPath)
	fileReader, err := os.Open(imageDiskPath)
	if err != nil {
		return err
	}
	defer fileReader.Close()

	// Set public access if not generating a signed URL
	pubAcc := !u.enableSignedURLs

	u.log.Debug("Uploading to GCS bucket using SDK", "bucket", u.bucket, "key", key, "public", pubAcc)

	uri := fmt.Sprintf("gs://%s/%s", u.bucket, key)

	wc := client.Bucket(u.bucket).Object(key).NewWriter(ctx)
	if pubAcc {
		wc.ObjectAttrs.PredefinedACL = "publicRead"
	}
	if _, err := io.Copy(wc, fileReader); err != nil {
		_ = wc.Close()
		return fmt.Errorf("failed to upload to %s: %s", uri, err)
	}
	if err := wc.Close(); err != nil {
		return fmt.Errorf("failed to upload to %s: %s", uri, err)
	}

	return nil
}

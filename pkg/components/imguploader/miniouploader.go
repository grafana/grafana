package imguploader

import (
	"context"
    "net/url"
    "time"
    "log"

	"github.com/minio/minio-go"
	"github.com/grafana/grafana/pkg/util"
)

type MinioUploader struct {
	endpoint        string
	bucketName      string
	accessKeyID     string
	secretAccessKey string
	expiry          int
	useSSL          bool
	log             log.Logger
}

func NewMinioUploader(endpoint string, bucketName string, accessKeyID string, secretAccessKey string, expiry int, useSSL bool) *MinioUploader {
	return &MinioUploader{
		endpoint:        endpoint,
		bucketName:      bucketName,
		accessKeyID:     accessKeyID,
		secretAccessKey: secretAccessKey,
		expiry:          expiry,
		useSSL:          useSSL,
	}
}

func (u *MinioUploader) Upload(ctx context.Context, imageDiskPath string) (string, error) {

    // Initialize minio client object.
    minioClient, err := minio.New(u.endpoint, u.accessKeyID, u.secretAccessKey, u.useSSL)

    if err != nil {
       return "", err
    }

    //create random name for image
    objectName := util.GetRandomString(20) + ".png"
    contentType := "image/png"

    // Upload the image file with FPutObject
    n, err := minioClient.FPutObject(u.bucketName, objectName, imageDiskPath, minio.PutObjectOptions{ContentType:contentType})
    log.Printf("Successfully uploaded %s of size %d\n", objectName, n)

    if err != nil {
      return "", err
    }

    // Set request parameters for content-disposition.
    reqParams := make(url.Values)
    reqParams.Set("response-content-disposition", "attachment; filename=\"objectName\"")

    //convert int to time Duration type for PresignedGetObject below
    expirySeconds := time.Duration(u.expiry) * time.Second

    // Generates a presigned url which expires per the expiry config setting
    presignedURL, err := minioClient.PresignedGetObject(u.bucketName, objectName, expirySeconds, reqParams)
    if err != nil {
        return "", err
    }

    return presignedURL.String(), nil
}



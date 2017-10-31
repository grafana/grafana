package imguploader

import (
	"context"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/endpoints"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
)

type S3Uploader struct {
	region    string
	bucket    string
	path      string
	acl       string
	secretKey string
	accessKey string
	log       log.Logger
}

func NewS3Uploader(region, bucket, path, acl, accessKey, secretKey string) *S3Uploader {
	return &S3Uploader{
		region:    region,
		bucket:    bucket,
		path:      path,
		acl:       acl,
		accessKey: accessKey,
		secretKey: secretKey,
		log:       log.New("s3uploader"),
	}
}

func (u *S3Uploader) Upload(ctx context.Context, imageDiskPath string) (string, error) {
	sess, err := session.NewSession()
	if err != nil {
		return "", err
	}
	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.StaticProvider{Value: credentials.Value{
				AccessKeyID:     u.accessKey,
				SecretAccessKey: u.secretKey,
			}},
			&credentials.EnvProvider{},
			&ec2rolecreds.EC2RoleProvider{Client: ec2metadata.New(sess), ExpiryWindow: 5 * time.Minute},
		})
	cfg := &aws.Config{
		Region:      aws.String(u.region),
		Credentials: creds,
	}

	s3_endpoint, _ := endpoints.DefaultResolver().EndpointFor("s3", u.region)
	key := u.path + util.GetRandomString(20) + ".png"
	image_url := s3_endpoint.URL + "/" + u.bucket + "/" + key
	log.Debug("Uploading image to s3", "url = ", image_url)

	file, err := os.Open(imageDiskPath)
	if err != nil {
		return "", err
	}

	sess, err = session.NewSession(cfg)
	if err != nil {
		return "", err
	}
	svc := s3.New(sess, cfg)
	params := &s3.PutObjectInput{
		Bucket:      aws.String(u.bucket),
		Key:         aws.String(key),
		ACL:         aws.String(u.acl),
		Body:        file,
		ContentType: aws.String("image/png"),
	}
	_, err = svc.PutObject(params)
	if err != nil {
		return "", err
	}
	return image_url, nil
}

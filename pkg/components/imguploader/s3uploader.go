package imguploader

import (
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
)

type S3Uploader struct {
	region    string
	bucket    string
	acl       string
	secretKey string
	accessKey string
	log       log.Logger
}

func NewS3Uploader(region, bucket, acl, accessKey, secretKey string) *S3Uploader {
	return &S3Uploader{
		region:    region,
		bucket:    bucket,
		acl:       acl,
		accessKey: accessKey,
		secretKey: secretKey,
		log:       log.New("s3uploader"),
	}
}

func (u *S3Uploader) Upload(imageDiskPath string) (string, error) {
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

	key := util.GetRandomString(20) + ".png"
	log.Debug("Uploading image to s3", "bucket = ", u.bucket, ", key = ", key)

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

	if u.region == "us-east-1" {
		return "https://" + u.bucket + ".s3.amazonaws.com/" + key, nil
	} else {
		return "https://" + u.bucket + ".s3-" + u.region + ".amazonaws.com/" + key, nil
	}
}

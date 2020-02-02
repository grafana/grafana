package imguploader

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go/aws/defaults"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

type S3Uploader struct {
	endpoint        string
	region          string
	bucket          string
	path            string
	acl             string
	secretKey       string
	accessKey       string
	pathStyleAccess bool
	log             log.Logger
}

func NewS3Uploader(endpoint, region, bucket, path, acl, accessKey, secretKey string, pathStyleAccess bool) *S3Uploader {
	return &S3Uploader{
		endpoint:        endpoint,
		region:          region,
		bucket:          bucket,
		path:            path,
		acl:             acl,
		accessKey:       accessKey,
		secretKey:       secretKey,
		pathStyleAccess: pathStyleAccess,
		log:             log.New("s3uploader"),
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
			remoteCredProvider(sess),
		})
	cfg := &aws.Config{
		Region:           aws.String(u.region),
		Endpoint:         aws.String(u.endpoint),
		S3ForcePathStyle: aws.Bool(u.pathStyleAccess),
		Credentials:      creds,
	}

	rand, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}
	key := u.path + rand + pngExt
	log.Debug("Uploading image to s3. bucket = %s, path = %s", u.bucket, key)

	file, err := os.Open(imageDiskPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	sess, err = session.NewSession(cfg)
	if err != nil {
		return "", err
	}
	uploader := s3manager.NewUploader(sess)
	result, err := uploader.UploadWithContext(ctx, &s3manager.UploadInput{
		Bucket:      aws.String(u.bucket),
		Key:         aws.String(key),
		ACL:         aws.String(u.acl),
		Body:        file,
		ContentType: aws.String("image/png"),
	})
	if err != nil {
		return "", err
	}
	return result.Location, nil
}

func remoteCredProvider(sess *session.Session) credentials.Provider {
	ecsCredURI := os.Getenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI")

	if len(ecsCredURI) > 0 {
		return ecsCredProvider(sess, ecsCredURI)
	}
	return ec2RoleProvider(sess)
}

func ecsCredProvider(sess *session.Session, uri string) credentials.Provider {
	const host = `169.254.170.2`

	d := defaults.Get()
	return endpointcreds.NewProviderClient(
		*d.Config,
		d.Handlers,
		fmt.Sprintf("http://%s%s", host, uri),
		func(p *endpointcreds.Provider) { p.ExpiryWindow = 5 * time.Minute })
}

func ec2RoleProvider(sess *session.Session) credentials.Provider {
	return &ec2rolecreds.EC2RoleProvider{Client: ec2metadata.New(sess), ExpiryWindow: 5 * time.Minute}
}

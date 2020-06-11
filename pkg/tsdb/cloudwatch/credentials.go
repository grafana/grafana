package cloudwatch

import (
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/defaults"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/grafana/grafana/pkg/setting"
)

// clientCache represents the interface a CloudWatchExecutor needs to access
// AWS service-specific clients in order to perform API requests.
type clientCache interface {
	cloudWatchClient(dsInfo *DatasourceInfo) (cloudwatchiface.CloudWatchAPI, error)
	ec2Client(dsInfo *DatasourceInfo) (ec2iface.EC2API, error)
	rgtaClient(dsInfo *DatasourceInfo) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI, error)
	logsClient(dsInfo *DatasourceInfo) (cloudwatchlogsiface.CloudWatchLogsAPI, error)
}

type cache struct {
	credential *credentials.Credentials
	expiration *time.Time
}

func (c *cache) cloudWatchClient(dsInfo *DatasourceInfo) (cloudwatchiface.CloudWatchAPI, error) {
	cfg, err := c.getAwsConfig(dsInfo)
	if err != nil {
		return nil, err
	}

	sess, err := session.NewSession(cfg)
	if err != nil {
		return nil, err
	}

	client := cloudwatch.New(sess, cfg)

	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})

	return client, nil
}

func (c *cache) ec2Client(dsInfo *DatasourceInfo) (ec2iface.EC2API, error) {
	cfg, err := c.getAwsConfig(dsInfo)
	if err != nil {
		return nil, fmt.Errorf("Failed to call ec2:getAwsConfig, %w", err)
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		return nil, fmt.Errorf("Failed to call ec2:NewSession, %w", err)
	}
	return ec2.New(sess, cfg), nil
}

func (c *cache) rgtaClient(dsInfo *DatasourceInfo) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI, error) {
	cfg, err := c.getAwsConfig(dsInfo)
	if err != nil {
		return nil, fmt.Errorf("Failed to call ec2:getAwsConfig, %w", err)
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		return nil, fmt.Errorf("Failed to call ec2:NewSession, %w", err)
	}
	return resourcegroupstaggingapi.New(sess, cfg), nil
}

func (c *cache) logsClient(dsInfo *DatasourceInfo) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	cfg, err := c.getAwsConfig(dsInfo)
	if err != nil {
		return nil, err
	}

	sess, err := session.NewSession(cfg)
	if err != nil {
		return nil, err
	}

	client := cloudwatchlogs.New(sess, cfg)

	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})

	return client, nil

}

func (c *cache) getCredentials(dsInfo *DatasourceInfo) (*credentials.Credentials, error) {
	if c.credential != nil &&
		c.expiration.After(time.Now().UTC()) {
		return c.credential, nil
	}

	accessKeyID := ""
	secretAccessKey := ""
	sessionToken := ""
	var expiration *time.Time = nil
	if dsInfo.AuthType == "arn" {
		params := &sts.AssumeRoleInput{
			RoleArn:         aws.String(dsInfo.AssumeRoleArn),
			RoleSessionName: aws.String("GrafanaSession"),
			DurationSeconds: aws.Int64(900),
		}

		stsSess, err := session.NewSession()
		if err != nil {
			return nil, err
		}
		stsCreds := credentials.NewChainCredentials(
			[]credentials.Provider{
				&credentials.EnvProvider{},
				&credentials.SharedCredentialsProvider{Filename: "", Profile: dsInfo.Profile},
				webIdentityProvider(stsSess),
				remoteCredProvider(stsSess),
			})
		stsConfig := &aws.Config{
			Region:      aws.String(dsInfo.Region),
			Credentials: stsCreds,
		}

		sess, err := session.NewSession(stsConfig)
		if err != nil {
			return nil, err
		}
		svc := sts.New(sess, stsConfig)
		resp, err := svc.AssumeRole(params)
		if err != nil {
			return nil, err
		}
		if resp.Credentials != nil {
			accessKeyID = *resp.Credentials.AccessKeyId
			secretAccessKey = *resp.Credentials.SecretAccessKey
			sessionToken = *resp.Credentials.SessionToken
			expiration = resp.Credentials.Expiration
		}
	} else {
		now := time.Now()
		e := now.Add(5 * time.Minute)
		expiration = &e
	}

	sess, err := session.NewSession()
	if err != nil {
		return nil, err
	}
	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.StaticProvider{Value: credentials.Value{
				AccessKeyID:     accessKeyID,
				SecretAccessKey: secretAccessKey,
				SessionToken:    sessionToken,
			}},
			&credentials.EnvProvider{},
			&credentials.StaticProvider{Value: credentials.Value{
				AccessKeyID:     dsInfo.AccessKey,
				SecretAccessKey: dsInfo.SecretKey,
			}},
			&credentials.SharedCredentialsProvider{Filename: "", Profile: dsInfo.Profile},
			webIdentityProvider(sess),
			remoteCredProvider(sess),
		})

	c.credential = creds
	c.expiration = expiration

	return creds, nil
}

func webIdentityProvider(sess *session.Session) credentials.Provider {
	svc := sts.New(sess)

	roleARN := os.Getenv("AWS_ROLE_ARN")
	tokenFilepath := os.Getenv("AWS_WEB_IDENTITY_TOKEN_FILE")
	roleSessionName := os.Getenv("AWS_ROLE_SESSION_NAME")
	return stscreds.NewWebIdentityRoleProvider(svc, roleARN, roleSessionName, tokenFilepath)
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

func (c *cache) getAwsConfig(dsInfo *DatasourceInfo) (*aws.Config, error) {
	creds, err := c.getCredentials(dsInfo)
	if err != nil {
		return nil, err
	}

	cfg := &aws.Config{
		Region:      aws.String(dsInfo.Region),
		Credentials: creds,
	}

	return cfg, nil
}

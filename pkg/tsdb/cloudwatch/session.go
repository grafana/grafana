package cloudwatch

import (
	"fmt"
	"sync"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
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

// sessionCache is an implementation of clientCache that caches sessions
// per-region in order to provide AWS API service clients on-demand while
// loading configuration options as few times as possible.
type sessionCache struct {
	// awsRegionSessions holds sessions for the different AWS regions and which
	// AuthType was used to generate them.
	awsRegionSessions map[string]*session.Session
	lock              sync.RWMutex
}

func newSessionCache() *sessionCache {
	return &sessionCache{awsRegionSessions: make(map[string]*session.Session)}
}

// newAwsSession creates a new *session.Session given the Authentication
// Provider configuration in the given DataSourceInfo.
func (s *sessionCache) newAwsSession(dsInfo *DatasourceInfo) (*session.Session, error) {

	accessKeyID := ""
	secretAccessKey := ""
	sessionToken := ""
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
		}
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

	cfg := &aws.Config{
		Region:      aws.String(dsInfo.Region),
		Credentials: creds,
	}

	return session.NewSession(cfg)
}

// session returns an appropriate session.Session for the configuration given in the
// DataSourceInfo. This method is primarily used internally by the API-specific
// methods such as `cloudWatchClient`.
func (s *sessionCache) session(dsInfo *DatasourceInfo) (*session.Session, error) {
	region := dsInfo.Region

	s.lock.RLock()
	sess := s.awsRegionSessions[region]
	s.lock.RUnlock()
	if sess != nil {
		return sess, nil
	}

	// Since it doesn't already exist we need to create it. Fetch a write lock
	s.lock.Lock()
	defer s.lock.Unlock()

	// Someone might've been faster than us so check again
	sess = s.awsRegionSessions[region]
	if sess != nil {
		return sess, nil
	}

	sess, err := s.newAwsSession(dsInfo)
	if err != nil {
		return nil, fmt.Errorf("creating new session for region %q failed: %w", region, err)
	}
	s.awsRegionSessions[region] = sess

	return sess, nil
}

func (s *sessionCache) cloudWatchClient(dsInfo *DatasourceInfo) (cloudwatchiface.CloudWatchAPI, error) {
	sess, err := s.session(dsInfo)
	if err != nil {
		return nil, err
	}

	client := cloudwatch.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})
	return client, nil
}

func (s *sessionCache) ec2Client(dsInfo *DatasourceInfo) (ec2iface.EC2API, error) {
	sess, err := s.session(dsInfo)
	if err != nil {
		return nil, err
	}

	client := ec2.New(sess)
	return client, nil
}

func (s *sessionCache) rgtaClient(dsInfo *DatasourceInfo) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI, error) {
	sess, err := s.session(dsInfo)
	if err != nil {
		return nil, err
	}

	client := resourcegroupstaggingapi.New(sess)
	return client, nil
}

func (s *sessionCache) logsClient(dsInfo *DatasourceInfo) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	sess, err := s.session(dsInfo)
	if err != nil {
		return nil, err
	}

	client := cloudwatchlogs.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})
	return client, nil
}

package cloudwatch

import (
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
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
	regionConfiguration := &aws.Config{
		Region: aws.String(dsInfo.Region),
	}

	switch dsInfo.AuthType {
	case "arn":
		stsSess, err := session.NewSession(regionConfiguration)
		if err != nil {
			return nil, fmt.Errorf("creating session for AssumeRoleProvider failed: %w", err)
		}

		provider := &stscreds.AssumeRoleProvider{
			Client:          sts.New(stsSess),
			RoleARN:         dsInfo.AssumeRoleArn,
			RoleSessionName: "GrafanaSession",
			Duration:        15 * time.Minute,
		}

		return session.NewSession(regionConfiguration, &aws.Config{
			Credentials: credentials.NewCredentials(provider),
		})
	case "credentials":
		return session.NewSession(regionConfiguration, &aws.Config{
			Credentials: credentials.NewSharedCredentials("", dsInfo.Profile),
		})
	case "keys":
		provider := &credentials.StaticProvider{Value: credentials.Value{
			AccessKeyID:     dsInfo.AccessKey,
			SecretAccessKey: dsInfo.SecretKey,
		}}
		return session.NewSession(regionConfiguration, &aws.Config{
			Credentials: credentials.NewCredentials(provider),
		})
	case "sdk":
		return session.NewSession(regionConfiguration)
	}

	return nil, fmt.Errorf(`%q is not a valid authentication type - expected "arn", "credentials", "keys" or "sdk"`, dsInfo.AuthType)
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

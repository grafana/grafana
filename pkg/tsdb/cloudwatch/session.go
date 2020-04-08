package cloudwatch

import (
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sts"
)

type sessionCache struct {
	// awsRegionSessions holds sessions for the different aws regions and which
	// AuthType was used to generate them
	awsRegionSessions map[string]*session.Session
	lock              sync.RWMutex
}

func newSessionCache() *sessionCache {
	return &sessionCache{awsRegionSessions: make(map[string]*session.Session)}
}

func (s *sessionCache) newAwsSession(dsInfo *DatasourceInfo) (*session.Session, error) {
	regionConfiguration := &aws.Config{
		Region: aws.String(dsInfo.Region),
	}

	switch dsInfo.AuthType {
	case "arn":
		stsSess, err := session.NewSession(regionConfiguration)
		if err != nil {
			return nil, fmt.Errorf("creating session for AssumeRoleProvider: %w", err)
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

	return nil, fmt.Errorf(`%q is not a valid authentication type. Expected "arn", "credentials", "keys" or "sdk"`, dsInfo.AuthType)
}

func (s *sessionCache) Get(dsInfo *DatasourceInfo) (*session.Session, error) {
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
		return nil, fmt.Errorf("creating new session for region %q: %w", region, err)
	}
	s.awsRegionSessions[region] = sess

	return sess, nil
}

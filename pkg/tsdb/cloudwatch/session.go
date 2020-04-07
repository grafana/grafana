package cloudwatch

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sts"
)

var (
	globalSessionCache = sessionCache{awsRegionSessions: make(map[string]*generatedSession)}
)

type generatedSession struct {
	sess     *session.Session
	authType string
}

type sessionCache struct {
	// awsRegionSessions holds sessions for the different aws regions and which
	// AuthType was used to generate them
	awsRegionSessions map[string]*generatedSession
	lock              sync.RWMutex
}

func (s *sessionCache) newAwsSession(dsInfo *DatasourceInfo) (*generatedSession, error) {
	fmt.Println(s, "creating session", dsInfo.AuthType)

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

		sess, err := session.NewSession(regionConfiguration, &aws.Config{
			Credentials: credentials.NewCredentials(provider),
		})

		return &generatedSession{sess: sess, authType: dsInfo.AuthType}, err
	case "credentials":
		sess, err := session.NewSession(regionConfiguration, &aws.Config{
			Credentials: credentials.NewSharedCredentials("", dsInfo.Profile),
		})
		return &generatedSession{sess: sess, authType: dsInfo.AuthType}, err
	case "keys":
		provider := &credentials.StaticProvider{Value: credentials.Value{
			AccessKeyID:     dsInfo.AccessKey,
			SecretAccessKey: dsInfo.SecretKey,
		}}
		sess, err := session.NewSession(regionConfiguration, &aws.Config{
			Credentials: credentials.NewCredentials(provider),
		})
		return &generatedSession{sess: sess, authType: dsInfo.AuthType}, err
	case "sdk":
		sess, err := session.NewSession(regionConfiguration)
		return &generatedSession{sess: sess, authType: dsInfo.AuthType}, err
	}

	return nil, errors.New("no valid authType")
}

func (s *sessionCache) Get(dsInfo *DatasourceInfo) (*session.Session, error) {
	region := dsInfo.Region
	fmt.Println(s, "getting session for ", region)

	s.lock.RLock()
	sess := s.awsRegionSessions[region]
	s.lock.RUnlock()
	if sess != nil && sess.authType == dsInfo.AuthType {
		return sess.sess, nil
	}

	// Since it doesn't already exist we need to create it. Fetch a write lock
	s.lock.Lock()
	defer s.lock.Unlock()

	// Someone might've been faster than us so check again
	sess = s.awsRegionSessions[region]
	if sess != nil && sess.authType == dsInfo.AuthType {
		return sess.sess, nil
	}

	sess, err := s.newAwsSession(dsInfo)
	if err != nil {
		return nil, fmt.Errorf("creating new session for region %q: %w", region, err)
	}
	fmt.Println("saving new sess ", region)
	s.awsRegionSessions[region] = sess

	return sess.sess, nil
}

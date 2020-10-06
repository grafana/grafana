package cloudwatch

import (
	"os"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/aws/aws-sdk-go/service/sts/stsiface"
	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mock_stsiface"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestECSCredProvider(t *testing.T) {
	os.Setenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", "/abc/123")
	t.Cleanup(func() {
		os.Unsetenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI")
	})

	sess, err := session.NewSession()
	require.NoError(t, err)
	provider := remoteCredProvider(sess)
	require.NotNil(t, provider)

	ecsProvider, ok := provider.(*endpointcreds.Provider)
	require.NotNil(t, ecsProvider)
	require.True(t, ok)

	assert.Equal(t, "http://169.254.170.2/abc/123", ecsProvider.Client.Endpoint)
}

func TestDefaultEC2RoleProvider(t *testing.T) {
	sess, err := session.NewSession()
	require.NoError(t, err)
	provider := remoteCredProvider(sess)
	require.NotNil(t, provider)

	ec2Provider, ok := provider.(*ec2rolecreds.EC2RoleProvider)
	require.NotNil(t, ec2Provider)
	require.True(t, ok)
}

func TestGetCredentials_ARNAuthType(t *testing.T) {
	ctrl := gomock.NewController(t)
	var stsMock *mock_stsiface.MockSTSAPI

	origNewSession := newSession
	origNewSTSService := newSTSService
	origNewEC2Metadata := newEC2Metadata
	t.Cleanup(func() {
		newSession = origNewSession
		newSTSService = origNewSTSService
		newEC2Metadata = origNewEC2Metadata
	})
	newSession = func(cfgs ...*aws.Config) (*session.Session, error) {
		return &session.Session{}, nil
	}
	newSTSService = func(p client.ConfigProvider, cfgs ...*aws.Config) stsiface.STSAPI {
		return stsMock
	}
	newEC2Metadata = func(p client.ConfigProvider, cfgs ...*aws.Config) *ec2metadata.EC2Metadata {
		return nil
	}

	t.Run("Without external ID", func(t *testing.T) {
		stsMock = mock_stsiface.NewMockSTSAPI(ctrl)
		stsMock.
			EXPECT().
			AssumeRole(gomock.Eq(&sts.AssumeRoleInput{
				RoleArn:         aws.String(""),
				DurationSeconds: aws.Int64(900),
				RoleSessionName: aws.String("GrafanaSession"),
			})).
			Return(&sts.AssumeRoleOutput{
				Credentials: &sts.Credentials{
					AccessKeyId:     aws.String("id"),
					SecretAccessKey: aws.String("secret"),
					SessionToken:    aws.String("token"),
				},
			}, nil).
			Times(1)

		creds, err := getCredentials(&datasourceInfo{
			AuthType: "arn",
		})
		require.NoError(t, err)
		require.NotNil(t, creds)
	})

	t.Run("With external ID", func(t *testing.T) {
		stsMock = mock_stsiface.NewMockSTSAPI(ctrl)
		stsMock.
			EXPECT().
			AssumeRole(gomock.Eq(&sts.AssumeRoleInput{
				RoleArn:         aws.String(""),
				DurationSeconds: aws.Int64(900),
				RoleSessionName: aws.String("GrafanaSession"),
				ExternalId:      aws.String("external-id"),
			})).
			Return(&sts.AssumeRoleOutput{
				Credentials: &sts.Credentials{
					AccessKeyId:     aws.String("id"),
					SecretAccessKey: aws.String("secret"),
					SessionToken:    aws.String("token"),
				},
			}, nil).
			Times(1)

		creds, err := getCredentials(&datasourceInfo{
			AuthType:   "arn",
			ExternalID: "external-id",
		})
		require.NoError(t, err)
		require.NotNil(t, creds)
	})
}

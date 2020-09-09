package cloudwatch

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test cloudWatchExecutor.newSession with assumption of IAM role.
func TestNewSession_AssumeRole(t *testing.T) {
	origNewSession := newSession
	origNewSTSCredentials := newSTSCredentials
	origNewEC2Metadata := newEC2Metadata
	t.Cleanup(func() {
		newSession = origNewSession
		newSTSCredentials = origNewSTSCredentials
		newEC2Metadata = origNewEC2Metadata
	})
	newSession = func(cfgs ...*aws.Config) (*session.Session, error) {
		cfg := aws.Config{}
		cfg.MergeIn(cfgs...)
		return &session.Session{
			Config: &cfg,
		}, nil
	}
	newSTSCredentials = func(c client.ConfigProvider, roleARN string,
		options ...func(*stscreds.AssumeRoleProvider)) *credentials.Credentials {
		p := &stscreds.AssumeRoleProvider{
			RoleARN: roleARN,
		}
		for _, o := range options {
			o(p)
		}

		return credentials.NewCredentials(p)
	}
	newEC2Metadata = func(p client.ConfigProvider, cfgs ...*aws.Config) *ec2metadata.EC2Metadata {
		return nil
	}

	t.Run("Without external ID", func(t *testing.T) {
		const roleARN = "test"

		e := newExecutor()
		e.DataSource = fakeDataSource(fakeDataSourceCfg{
			assumeRoleARN: roleARN,
		})

		sess, err := e.newSession(defaultRegion)
		require.NoError(t, err)
		require.NotNil(t, sess)

		p := &stscreds.AssumeRoleProvider{
			RoleARN: roleARN,
		}
		expCreds := credentials.NewCredentials(p)
		assert.Equal(t, expCreds, sess.Config.Credentials)
	})

	t.Run("With external ID", func(t *testing.T) {
		const roleARN = "test"
		const externalID = "external"

		e := newExecutor()
		e.DataSource = fakeDataSource(fakeDataSourceCfg{
			assumeRoleARN: roleARN,
			externalID:    externalID,
		})

		sess, err := e.newSession(defaultRegion)
		require.NoError(t, err)
		require.NotNil(t, sess)

		p := &stscreds.AssumeRoleProvider{
			RoleARN:    roleARN,
			ExternalID: aws.String(externalID),
		}
		expCreds := credentials.NewCredentials(p)
		assert.Equal(t, expCreds, sess.Config.Credentials)
	})
}

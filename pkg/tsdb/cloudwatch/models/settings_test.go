package models

import (
	"testing"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_Settings_LoadCloudWatchSettings(t *testing.T) {
	t.Run("Should parse keys query type", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "keys",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"customMetricsNamespaces": "AWS/EC2,AWS/ELB",
			"defaultRegion": "us-east-1",
			"externalId": "123456789012",
			"profile": "default",
			"endpoint": "https://monitoring.us-east-1.amazonaws.com"
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		s, err := LoadCloudWatchSettings(settings)
		require.NoError(t, err)
		assert.Equal(t, awsds.AuthTypeKeys, s.AuthType)
		assert.Equal(t, "arn:aws:iam::123456789012:role/grafana", s.AssumeRoleARN)
		assert.Equal(t, "AWS/EC2,AWS/ELB", s.Namespace)
		assert.Equal(t, "us-east-1", s.Region)
		assert.Equal(t, "123456789012", s.ExternalID)
		assert.Equal(t, "default", s.Profile)
		assert.Equal(t, "https://monitoring.us-east-1.amazonaws.com", s.Endpoint)
		assert.Equal(t, "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", s.SecretKey)
		assert.Equal(t, "AKIAIOSFODNN7EXAMPLE", s.AccessKey)
	})

	t.Run("Should handle legacy auth type arn as default", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "arn",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"customMetricsNamespaces": "AWS/EC2,AWS/ELB",
			"defaultRegion": "us-east-1",
			"externalId": "123456789012",
			"profile": "default",
			"endpoint": "https://monitoring.us-east-1.amazonaws.com"
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		s, err := LoadCloudWatchSettings(settings)
		require.NoError(t, err)
		assert.Equal(t, awsds.AuthTypeDefault, s.AuthType)
		assert.Equal(t, "arn:aws:iam::123456789012:role/grafana", s.AssumeRoleARN)
		assert.Equal(t, "AWS/EC2,AWS/ELB", s.Namespace)
		assert.Equal(t, "us-east-1", s.Region)
		assert.Equal(t, "123456789012", s.ExternalID)
		assert.Equal(t, "default", s.Profile)
		assert.Equal(t, "https://monitoring.us-east-1.amazonaws.com", s.Endpoint)
		assert.Equal(t, "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", s.SecretKey)
		assert.Equal(t, "AKIAIOSFODNN7EXAMPLE", s.AccessKey)
	})
}

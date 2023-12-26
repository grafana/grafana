package models

import (
	"testing"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_Settings_LoadCloudWatchSettings(t *testing.T) {
	t.Run("Should return error for invalid json", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": fluffles^.^,
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"logsTimeout": "10m"
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		_, err := LoadCloudWatchSettings(settings)

		assert.Error(t, err)
	})
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
	t.Run("Should set logsTimeout to default duration if it is not defined", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "arn",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana"
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		s, err := LoadCloudWatchSettings(settings)
		require.NoError(t, err)
		assert.Equal(t, time.Minute*30, s.LogsTimeout.Duration)
	})
	t.Run("Should correctly parse logsTimeout duration string", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "arn",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"logsTimeout": "10m"
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		s, err := LoadCloudWatchSettings(settings)
		require.NoError(t, err)
		assert.Equal(t, time.Minute*10, s.LogsTimeout.Duration)
	})
	t.Run("Should correctly parse logsTimeout string with float number", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "arn",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"logsTimeout": "1.5s"
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		s, err := LoadCloudWatchSettings(settings)
		require.NoError(t, err)
		assert.Equal(t, time.Duration(1500000000), s.LogsTimeout.Duration)
	})
	t.Run("Should correctly parse logsTimeout duration in nanoseconds", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "arn",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"logsTimeout": 1500000000
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		s, err := LoadCloudWatchSettings(settings)
		require.NoError(t, err)
		assert.Equal(t, 1500*time.Millisecond, s.LogsTimeout.Duration)
	})
	t.Run("Should throw error if logsTimeout is an invalid duration format", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "arn",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"logsTimeout": "10mm"
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		_, err := LoadCloudWatchSettings(settings)
		require.Error(t, err)
	})
	t.Run("Should throw error if logsTimeout is an invalid type", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			ID: 33,
			JSONData: []byte(`{
			"authType": "arn",
			"assumeRoleArn": "arn:aws:iam::123456789012:role/grafana",
			"logsTimeout": true
		  }`),
			DecryptedSecureJSONData: map[string]string{
				"accessKey": "AKIAIOSFODNN7EXAMPLE",
				"secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		}

		_, err := LoadCloudWatchSettings(settings)
		require.Error(t, err)
	})
}

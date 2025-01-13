package gmsclient

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_buildBasePath(t *testing.T) {
	t.Parallel()

	// Domain is required
	_, err := NewGMSClient(&setting.Cfg{
		CloudMigration: setting.CloudMigrationSettings{
			GMSDomain: "",
		},
	},
		http.DefaultClient,
	)
	require.Error(t, err)

	// Domain is required
	c, err := NewGMSClient(&setting.Cfg{
		CloudMigration: setting.CloudMigrationSettings{
			GMSDomain: "non-empty",
		},
	},
		http.DefaultClient,
	)
	require.NoError(t, err)
	client := c.(*gmsClientImpl)

	tests := []struct {
		description string
		domain      string
		clusterSlug string
		expected    string
	}{
		{
			description: "domain starts with http://, should return domain",
			domain:      "http://some-domain:8080",
			clusterSlug: "anything",
			expected:    "http://some-domain:8080",
		},
		{
			description: "domain starts with https://, should return domain",
			domain:      "https://some-domain:8080",
			clusterSlug: "anything",
			expected:    "https://some-domain:8080",
		},
		{
			description: "domain doesn't start with http or https, should build a string using the domain and clusterSlug",
			domain:      "gms-dev",
			clusterSlug: "us-east-1",
			expected:    "https://cms-us-east-1.gms-dev/cloud-migrations",
		},
	}
	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			client.cfg.CloudMigration.GMSDomain = tt.domain
			assert.Equal(t, tt.expected, client.buildBasePath(tt.clusterSlug))
		})
	}
}

func Test_handleGMSErrors(t *testing.T) {
	t.Parallel()

	c, err := NewGMSClient(&setting.Cfg{
		CloudMigration: setting.CloudMigrationSettings{
			GMSDomain: "http://some-domain:8080",
		},
	},
		http.DefaultClient,
	)
	require.NoError(t, err)
	client := c.(*gmsClientImpl)

	testscases := []struct {
		gmsResBody    []byte
		expectedError error
	}{
		{
			gmsResBody:    []byte(`{"message":"instance is unreachable, make sure the instance is running"}`),
			expectedError: cloudmigration.ErrInstanceUnreachable,
		},
		{
			gmsResBody:    []byte(`{"message":"checking if instance is reachable"}`),
			expectedError: cloudmigration.ErrInstanceRequestError,
		},
		{
			gmsResBody:    []byte(`{"message":"fetching instance by stack id 1234"}`),
			expectedError: cloudmigration.ErrInstanceRequestError,
		},
		{
			gmsResBody:    []byte(`{"status":"error","error":"authentication error: invalid token"}`),
			expectedError: cloudmigration.ErrTokenValidationFailure,
		},
		{
			gmsResBody:    []byte(""),
			expectedError: cloudmigration.ErrTokenValidationFailure,
		},
	}

	for _, tc := range testscases {
		resError := client.handleGMSErrors(tc.gmsResBody)
		require.ErrorIs(t, resError, tc.expectedError)
	}
}

package gmsclient

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_buildURL(t *testing.T) {
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
		path        string
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
			description: "domain starts with https://, should return domain",
			domain:      "https://some-domain:8080",
			clusterSlug: "anything",
			path:        "/test?foo=bar&baz=qax#fragment",
			expected:    "https://some-domain:8080/test?foo=bar&baz=qax#fragment",
		},
		{
			description: "domain doesn't start with http or https, should build a string using the domain and clusterSlug",
			domain:      "gms-dev",
			clusterSlug: "us-east-1",
			expected:    "https://cms-us-east-1.gms-dev/cloud-migrations",
		},
		{
			description: "it parses and escapes the path when building the URL",
			domain:      "gms-dev",
			clusterSlug: "use-east-1",
			path:        `/this//is//a/\very-Nice_páTh?x=/çç&y=/éé#aaaa`,
			expected:    "https://cms-use-east-1.gms-dev/cloud-migrations/this//is//a/%5Cvery-Nice_p%C3%A1Th?x=/çç&y=/éé#aaaa",
		},
	}
	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			client.cfg.CloudMigration.GMSDomain = tt.domain

			url, err := client.buildURL(tt.clusterSlug, tt.path)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, url)
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

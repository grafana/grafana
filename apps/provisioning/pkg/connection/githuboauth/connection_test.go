package githuboauth

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	oauth2github "golang.org/x/oauth2/github"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
)

func TestProvider_Test(t *testing.T) {
	tests := []struct {
		name          string
		clientErr     error
		expectedCode  int
		expectSuccess bool
		errorContains string
	}{
		{name: "token accepted", expectedCode: http.StatusOK, expectSuccess: true},
		{name: "token rejected", clientErr: repository.ErrUnauthorized, expectedCode: http.StatusUnauthorized, errorContains: "rejected the connection's access token"},
		{name: "other error", clientErr: errors.New("boom"), expectedCode: http.StatusUnprocessableEntity, errorContains: "failed to list repositories: boom"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := github.NewMockClient(t)
			client.EXPECT().ListRepositories(mock.Anything).Return(nil, tt.clientErr)

			results, err := (&provider{client: client}).Test(t.Context())
			require.NoError(t, err)
			assert.Equal(t, tt.expectSuccess, results.Success)
			assert.Equal(t, tt.expectedCode, results.Code)
			if tt.errorContains != "" {
				require.Len(t, results.Errors, 1)
				assert.Contains(t, results.Errors[0].Detail, tt.errorContains)
			}
		})
	}
}

func TestProvider_ListRepositories(t *testing.T) {
	repos := []provisioning.ExternalRepository{
		{Name: "repo-one", Owner: "my-org", URL: "https://github.com/my-org/repo-one"},
		{Name: "repo-two", Owner: "my-org", URL: "https://github.com/my-org/repo-two"},
	}

	client := github.NewMockClient(t)
	client.EXPECT().ListRepositories(mock.Anything).Return(repos, nil)

	p := &provider{client: client}
	got, err := p.ListRepositories(t.Context())
	require.NoError(t, err)
	assert.Equal(t, repos, got)
}

func TestProvider_ListRepositories_Errors(t *testing.T) {
	tests := []struct {
		name      string
		clientErr error
		wantErr   error
	}{
		{name: "unauthorized maps to authentication error", clientErr: repository.ErrUnauthorized, wantErr: connection.ErrAuthentication},
		{name: "permission denied maps to authentication error", clientErr: repository.ErrPermissionDenied, wantErr: connection.ErrAuthentication},
		{name: "other errors are returned", clientErr: errors.New("boom")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := github.NewMockClient(t)
			client.EXPECT().ListRepositories(mock.Anything).Return(nil, tt.clientErr)

			p := &provider{client: client}
			_, err := p.ListRepositories(t.Context())
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
			} else {
				require.ErrorIs(t, err, tt.clientErr)
			}
		})
	}
}

func TestProvider_Endpoint(t *testing.T) {
	assert.Equal(t, oauth2github.Endpoint, (&provider{}).Endpoint())
}

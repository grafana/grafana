package github

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/google/go-github/v70/github"
	mockhub "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestIsAuthenticated(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		wantErr     error
	}{
		{
			name: "successful authentication",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatch(
					mockhub.GetUser,
					github.User{},
				),
			),
			wantErr: nil,
		},
		{
			name: "unauthorized - invalid token",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetUser,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusUnauthorized)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Bad credentials"}))
					}),
				),
			),
			wantErr: apierrors.NewUnauthorized("token is invalid or expired"),
		},
		{
			name: "forbidden - insufficient permissions",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetUser,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						w.WriteHeader(http.StatusForbidden)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Forbidden"}))
					}),
				),
			),
			wantErr: apierrors.NewUnauthorized("token is revoked or has insufficient permissions"),
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetUser,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Service unavailable"}))
					}),
				),
			),
			wantErr: ErrServiceUnavailable,
		},
		{
			name: "unknown error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetUser,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusInternalServerError)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Internal server error"}))
					}),
				),
			),
			wantErr: errors.New("500 Internal server error []"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.IsAuthenticated(context.Background())
			// Check the error
			if tt.wantErr == nil {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				var statusErr *apierrors.StatusError
				if errors.As(tt.wantErr, &statusErr) {
					// For StatusError, compare status code
					var actualStatusErr *apierrors.StatusError
					assert.True(t, errors.As(err, &actualStatusErr), "Expected StatusError but got different error type")
					if actualStatusErr != nil {
						assert.Equal(t, statusErr.Status().Code, actualStatusErr.Status().Code)
						assert.Equal(t, statusErr.Status().Message, actualStatusErr.Status().Message)
					}
				} else {
					// For regular errors, compare error messages
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			}
		})
	}
}
func TestGithubClient_RepoExists(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		want        bool
		wantErr     error
	}{
		{
			name: "repository exists",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]interface{}{
							"id":   123,
							"name": "test-repo",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			want:       true,
			wantErr:    nil,
		},
		{
			name: "repository does not exist",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Not Found"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "non-existent-repo",
			want:       false,
			wantErr:    nil,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Service unavailable"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			want:       false,
			wantErr:    errors.New("503 Service unavailable []"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			exists, err := client.RepoExists(context.Background(), tt.owner, tt.repository)

			// Check the result
			assert.Equal(t, tt.want, exists)

			// Check the error
			if tt.wantErr == nil {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr.Error())
			}
		})
	}
}

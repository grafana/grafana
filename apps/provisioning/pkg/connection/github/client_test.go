package github_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-github/v70/github"
	conngh "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	mockhub "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGithubClient_GetApp(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		token       string
		wantApp     conngh.App
		wantErr     error
	}{
		{
			name: "get app successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetApp,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						app := &github.App{
							ID:   github.Ptr(int64(12345)),
							Slug: github.Ptr("my-test-app"),
							Owner: &github.User{
								Login: github.Ptr("grafana"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(app))
					}),
				),
			),
			token: "test-token",
			wantApp: conngh.App{
				ID:    12345,
				Slug:  "my-test-app",
				Owner: "grafana",
			},
			wantErr: nil,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetApp,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusServiceUnavailable,
							},
							Message: "Service unavailable",
						}))
					}),
				),
			),
			token:   "test-token",
			wantApp: conngh.App{},
			wantErr: conngh.ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetApp,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusInternalServerError)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusInternalServerError,
							},
							Message: "Internal server error",
						}))
					}),
				),
			),
			token:   "test-token",
			wantApp: conngh.App{},
			wantErr: &github.ErrorResponse{
				Response: &http.Response{
					StatusCode: http.StatusInternalServerError,
				},
				Message: "Internal server error",
			},
		},
		{
			name: "unauthorized error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetApp,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusUnauthorized)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusUnauthorized,
							},
							Message: "Bad credentials",
						}))
					}),
				),
			),
			token:   "invalid-token",
			wantApp: conngh.App{},
			wantErr: &github.ErrorResponse{
				Response: &http.Response{
					StatusCode: http.StatusUnauthorized,
				},
				Message: "Bad credentials",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			ghClient := github.NewClient(tt.mockHandler)
			client := conngh.NewClient(ghClient)

			// Call the method being tested
			app, err := client.GetApp(context.Background())

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantApp, app)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantApp, app)
			}
		})
	}
}

func TestGithubClient_GetAppInstallation(t *testing.T) {
	tests := []struct {
		name             string
		mockHandler      *http.Client
		appToken         string
		installationID   string
		wantInstallation conngh.AppInstallation
		wantErr          bool
		errContains      string
	}{
		{
			name: "get disabled app installation successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						installation := &github.Installation{
							ID:          github.Ptr(int64(67890)),
							SuspendedAt: github.Ptr(github.Timestamp{Time: time.Now()}),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(installation))
					}),
				),
			),
			appToken:       "test-app-token",
			installationID: "67890",
			wantInstallation: conngh.AppInstallation{
				ID:      67890,
				Enabled: false,
			},
			wantErr: false,
		},
		{
			name: "get enabled app installation successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						installation := &github.Installation{
							ID:          github.Ptr(int64(67890)),
							SuspendedAt: nil,
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(installation))
					}),
				),
			),
			appToken:       "test-app-token",
			installationID: "67890",
			wantInstallation: conngh.AppInstallation{
				ID:      67890,
				Enabled: true,
			},
			wantErr: false,
		},
		{
			name:             "invalid installation ID",
			mockHandler:      mockhub.NewMockedHTTPClient(),
			appToken:         "test-app-token",
			installationID:   "not-a-number",
			wantInstallation: conngh.AppInstallation{},
			wantErr:          true,
			errContains:      "invalid installation ID",
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusServiceUnavailable,
							},
							Message: "Service unavailable",
						}))
					}),
				),
			),
			appToken:         "test-app-token",
			installationID:   "67890",
			wantInstallation: conngh.AppInstallation{},
			wantErr:          true,
		},
		{
			name: "installation not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusNotFound,
							},
							Message: "Not Found",
						}))
					}),
				),
			),
			appToken:         "test-app-token",
			installationID:   "99999",
			wantInstallation: conngh.AppInstallation{},
			wantErr:          true,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusInternalServerError)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusInternalServerError,
							},
							Message: "Internal server error",
						}))
					}),
				),
			),
			appToken:         "test-app-token",
			installationID:   "67890",
			wantInstallation: conngh.AppInstallation{},
			wantErr:          true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			ghClient := github.NewClient(tt.mockHandler)
			client := conngh.NewClient(ghClient)

			// Call the method being tested
			installation, err := client.GetAppInstallation(context.Background(), tt.installationID)

			// Check the error
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			assert.Equal(t, tt.wantInstallation, installation)
		})
	}
}

func TestGithubClient_CreateInstallationAccessToken(t *testing.T) {
	tests := []struct {
		name           string
		mockHandler    *http.Client
		installationID string
		repo           string
		wantToken      conngh.InstallationToken
		wantErr        bool
		errContains    string
	}{
		{
			name: "create installation token successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						expiresAt := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
						token := &github.InstallationToken{
							Token:     github.Ptr("ghs_test_token_123456789"),
							ExpiresAt: &github.Timestamp{Time: expiresAt},
						}
						w.WriteHeader(http.StatusCreated)
						require.NoError(t, json.NewEncoder(w).Encode(token))
					}),
				),
			),
			installationID: "12345",
			repo:           "test-repo",
			wantToken: conngh.InstallationToken{
				Token:     "ghs_test_token_123456789",
				ExpiresAt: "2024-01-01 00:00:00 +0000 UTC",
			},
			wantErr: false,
		},
		{
			name:           "invalid installation ID",
			mockHandler:    mockhub.NewMockedHTTPClient(),
			installationID: "not-a-number",
			repo:           "test-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
			errContains:    "invalid installation ID",
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusServiceUnavailable,
							},
							Message: "Service unavailable",
						}))
					}),
				),
			),
			installationID: "12345",
			repo:           "test-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
			errContains:    conngh.ErrServiceUnavailable.Error(),
		},
		{
			name: "installation not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusNotFound,
							},
							Message: "Not Found",
						}))
					}),
				),
			),
			installationID: "99999",
			repo:           "test-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
		},
		{
			name: "unauthorized error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusUnauthorized)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusUnauthorized,
							},
							Message: "Bad credentials",
						}))
					}),
				),
			),
			installationID: "12345",
			repo:           "test-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
		},
		{
			name: "forbidden - no permissions for repository",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusForbidden)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusForbidden,
							},
							Message: "Resource not accessible by integration",
						}))
					}),
				),
			),
			installationID: "12345",
			repo:           "private-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
		},
		{
			name: "internal server error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusInternalServerError)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusInternalServerError,
							},
							Message: "Internal server error",
						}))
					}),
				),
			),
			installationID: "12345",
			repo:           "test-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ghClient := github.NewClient(tt.mockHandler)
			client := conngh.NewClient(ghClient)

			token, err := client.CreateInstallationAccessToken(context.Background(), tt.installationID, tt.repo)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}

			assert.Equal(t, tt.wantToken, token)
		})
	}
}

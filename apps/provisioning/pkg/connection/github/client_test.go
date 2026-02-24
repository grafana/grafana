package github_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-github/v82/github"
	mockhub "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	conngh "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
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
							Permissions: &github.InstallationPermissions{
								Contents:        github.Ptr("write"),
								Metadata:        github.Ptr("read"),
								PullRequests:    github.Ptr("write"),
								RepositoryHooks: github.Ptr("write"),
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
				Permissions: conngh.Permissions{
					Contents:     conngh.PermissionWrite,
					Metadata:     conngh.PermissionRead,
					PullRequests: conngh.PermissionWrite,
					Webhooks:     conngh.PermissionWrite,
				},
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
			wantErr: conngh.ErrAuthentication,
		},
		{
			name: "not found error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetApp,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusNotFound,
							},
							Message: "Integration not found",
						}))
					}),
				),
			),
			token:   "test-token",
			wantApp: conngh.App{},
			wantErr: conngh.ErrNotFound,
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
			name: "get installation with all permissions",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						installation := &github.Installation{
							ID:          github.Ptr(int64(67890)),
							SuspendedAt: nil,
							Permissions: &github.InstallationPermissions{
								Contents:        github.Ptr("write"),
								Metadata:        github.Ptr("read"),
								PullRequests:    github.Ptr("write"),
								RepositoryHooks: github.Ptr("write"),
							},
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
				Permissions: conngh.Permissions{
					Contents:     conngh.PermissionWrite,
					Metadata:     conngh.PermissionRead,
					PullRequests: conngh.PermissionWrite,
					Webhooks:     conngh.PermissionWrite,
				},
			},
			wantErr: false,
		},
		{
			name: "get installation with nil permissions",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						installation := &github.Installation{
							ID:          github.Ptr(int64(67890)),
							SuspendedAt: nil,
							Permissions: nil,
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
			name: "get installation with partial permissions",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						installation := &github.Installation{
							ID:          github.Ptr(int64(67890)),
							SuspendedAt: nil,
							Permissions: &github.InstallationPermissions{
								Contents: github.Ptr("read"),
								Metadata: nil,
							},
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
				Permissions: conngh.Permissions{
					Contents: conngh.PermissionRead,
				},
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

func TestGithubClient_ListInstallationRepositories(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		wantRepos   []conngh.Repository
		wantErr     bool
		errContains string
	}{
		{
			name: "list repositories successfully - single page",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						response := &github.ListRepositories{
							TotalCount: github.Ptr(2),
							Repositories: []*github.Repository{
								{
									Name: github.Ptr("repo1"),
									Owner: &github.User{
										Login: github.Ptr("owner1"),
									},
									HTMLURL: github.Ptr("https://github.com/owner1/repo1"),
								},
								{
									Name: github.Ptr("repo2"),
									Owner: &github.User{
										Login: github.Ptr("owner2"),
									},
									HTMLURL: github.Ptr("https://github.com/owner2/repo2"),
								},
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			wantRepos: []conngh.Repository{
				{Name: "repo1", Owner: "owner1", URL: "https://github.com/owner1/repo1"},
				{Name: "repo2", Owner: "owner2", URL: "https://github.com/owner2/repo2"},
			},
			wantErr: false,
		},
		{
			name: "list repositories successfully - multiple pages",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						page := r.URL.Query().Get("page")
						switch page {
						case "", "1":
							// First page
							response := &github.ListRepositories{
								TotalCount: github.Ptr(3),
								Repositories: []*github.Repository{
									{
										Name: github.Ptr("repo1"),
										Owner: &github.User{
											Login: github.Ptr("owner1"),
										},
										HTMLURL: github.Ptr("https://github.com/owner1/repo1"),
									},
								},
							}
							w.Header().Set("Link", `<https://api.github.com/installation/repositories?page=2>; rel="next"`)
							w.WriteHeader(http.StatusOK)
							require.NoError(t, json.NewEncoder(w).Encode(response))
						case "2":
							// Second page
							response := &github.ListRepositories{
								TotalCount: github.Ptr(3),
								Repositories: []*github.Repository{
									{
										Name: github.Ptr("repo2"),
										Owner: &github.User{
											Login: github.Ptr("owner2"),
										},
										HTMLURL: github.Ptr("https://github.com/owner2/repo2"),
									},
									{
										Name: github.Ptr("repo3"),
										Owner: &github.User{
											Login: github.Ptr("owner3"),
										},
										HTMLURL: github.Ptr("https://github.com/owner3/repo3"),
									},
								},
							}
							w.WriteHeader(http.StatusOK)
							require.NoError(t, json.NewEncoder(w).Encode(response))
						}
					}),
				),
			),
			wantRepos: []conngh.Repository{
				{Name: "repo1", Owner: "owner1", URL: "https://github.com/owner1/repo1"},
				{Name: "repo2", Owner: "owner2", URL: "https://github.com/owner2/repo2"},
				{Name: "repo3", Owner: "owner3", URL: "https://github.com/owner3/repo3"},
			},
			wantErr: false,
		},
		{
			name: "empty repository list",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						response := &github.ListRepositories{
							TotalCount:   github.Ptr(0),
							Repositories: []*github.Repository{},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			wantRepos: nil,
			wantErr:   false,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
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
			wantRepos:   nil,
			wantErr:     true,
			errContains: conngh.ErrServiceUnavailable.Error(),
		},
		{
			name: "unauthorized error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
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
			wantRepos:   nil,
			wantErr:     true,
			errContains: "list repositories",
		},
		{
			name: "forbidden error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
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
			wantRepos:   nil,
			wantErr:     true,
			errContains: "list repositories",
		},
		{
			name: "internal server error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
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
			wantRepos:   nil,
			wantErr:     true,
			errContains: "list repositories",
		},
		{
			name: "too many repositories - exceeds max limit",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetInstallationRepositories,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						page := r.URL.Query().Get("page")
						pageNum := 1
						if page != "" && page != "1" {
							// Parse page number
							var err error
							_, err = fmt.Sscanf(page, "%d", &pageNum)
							require.NoError(t, err)
						}

						// Create 100 repos per page to simulate going over 1000 limit
						repos := make([]*github.Repository, 100)
						for i := 0; i < 100; i++ {
							repoNum := (pageNum-1)*100 + i + 1
							repos[i] = &github.Repository{
								Name: github.Ptr(fmt.Sprintf("repo%d", repoNum)),
								Owner: &github.User{
									Login: github.Ptr(fmt.Sprintf("owner%d", repoNum)),
								},
								HTMLURL: github.Ptr(fmt.Sprintf("https://github.com/owner%d/repo%d", repoNum, repoNum)),
							}
						}

						response := &github.ListRepositories{
							TotalCount:   github.Ptr(1200),
							Repositories: repos,
						}

						// Simulate pagination - 12 pages of 100 repos each
						if pageNum < 12 {
							w.Header().Set("Link", fmt.Sprintf(`<https://api.github.com/installation/repositories?page=%d>; rel="next"`, pageNum+1))
						}

						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			wantRepos:   nil,
			wantErr:     true,
			errContains: "too many repositories",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ghClient := github.NewClient(tt.mockHandler)
			client := conngh.NewClient(ghClient)

			repos, err := client.ListInstallationRepositories(context.Background())

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}

			assert.Equal(t, tt.wantRepos, repos)
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
				ExpiresAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
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
			name: "unprocessable entity - no access to repository",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusUnprocessableEntity)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusUnprocessableEntity,
							},
							Message: "Installation does not have access to repository",
						}))
					}),
				),
			),
			installationID: "12345",
			repo:           "private-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
			errContains:    conngh.ErrUnprocessableEntity.Error(),
		},
		{
			name: "authentication error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostAppInstallationsAccessTokensByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusUnauthorized)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusUnauthorized,
							},
							Message: "Installation does not have access to repository",
						}))
					}),
				),
			),
			installationID: "12345",
			repo:           "private-repo",
			wantToken:      conngh.InstallationToken{},
			wantErr:        true,
			errContains:    conngh.ErrAuthentication.Error(),
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
			errContains:    conngh.ErrNotFound.Error(),
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

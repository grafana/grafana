package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

func TestGithubClient_GetContents(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		path        string
		ref         string
		wantFile    bool
		wantDir     bool
		wantErr     error
	}{
		{
			name: "get file contents",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						fileContent := &github.RepositoryContent{
							Type:     github.String("file"),
							Name:     github.String("test.txt"),
							Path:     github.String("test.txt"),
							Content:  github.String("dGVzdCBjb250ZW50"), // base64 encoded "test content"
							Encoding: github.String("base64"),
							Size:     github.Int(12),
							SHA:      github.String("abc123"),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(fileContent))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			ref:        "main",
			wantFile:   true,
			wantDir:    false,
			wantErr:    nil,
		},
		{
			name: "get directory contents",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						dirContents := []*github.RepositoryContent{
							{
								Type: github.String("file"),
								Name: github.String("file1.txt"),
								Path: github.String("dir/file1.txt"),
								Size: github.Int(100),
								SHA:  github.String("abc123"),
							},
							{
								Type: github.String("dir"),
								Name: github.String("subdir"),
								Path: github.String("dir/subdir"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(dirContents))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "dir",
			ref:        "main",
			wantFile:   false,
			wantDir:    true,
			wantErr:    nil,
		},
		{
			name: "resource not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Not Found"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "nonexistent.txt",
			ref:        "main",
			wantFile:   false,
			wantDir:    false,
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Service unavailable"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			ref:        "main",
			wantFile:   false,
			wantDir:    false,
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "file too large",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						fileContent := &github.RepositoryContent{
							Type:     github.String("file"),
							Name:     github.String("large.txt"),
							Path:     github.String("large.txt"),
							Content:  github.String(""),
							Encoding: github.String("base64"),
							Size:     github.Int(maxFileSize + 1), // Exceeds max file size
							SHA:      github.String("abc123"),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(fileContent))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "large.txt",
			ref:        "main",
			wantFile:   false,
			wantDir:    false,
			wantErr:    ErrFileTooLarge,
		},
		{
			name: "not a github error response",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusConflict)
						// Return a non-GitHub error format
						w.Write([]byte("not a github error"))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			ref:        "main",
			wantFile:   false,
			wantDir:    false,
			wantErr:    errors.New("409"),
		},
		{
			name: "directory with too many items",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Create a directory with more than maxDirectoryItems
						dirContents := make([]*github.RepositoryContent, maxDirectoryItems+1)
						for i := 0; i < maxDirectoryItems+1; i++ {
							dirContents[i] = &github.RepositoryContent{
								Type: github.Ptr("file"),
								Name: github.Ptr(fmt.Sprintf("file%d.txt", i)),
								Path: github.Ptr(fmt.Sprintf("dir/file%d.txt", i)),
								Size: github.Ptr(100),
								SHA:  github.Ptr(fmt.Sprintf("sha%d", i)),
							}
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(dirContents))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "dir",
			ref:        "main",
			wantFile:   false,
			wantDir:    false,
			wantErr:    fmt.Errorf("directory contains too many items (more than %d)", maxDirectoryItems),
		},
		{
			name: "error response with other status code",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusForbidden)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusForbidden,
							},
							Message: "Forbidden access",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			ref:        "main",
			wantFile:   false,
			wantDir:    false,
			wantErr:    errors.New("Forbidden access"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			fileContent, dirContents, err := client.GetContents(context.Background(), tt.owner, tt.repository, tt.path, tt.ref)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr.Error())
				assert.Nil(t, fileContent)
				assert.Nil(t, dirContents)
				return
			}
			assert.NoError(t, err)

			// Check the result
			if tt.wantFile {
				assert.NotNil(t, fileContent)
				assert.Nil(t, dirContents)
			} else if tt.wantDir {
				assert.Nil(t, fileContent)
				assert.NotNil(t, dirContents)
				assert.Greater(t, len(dirContents), 0)
			}
		})
	}
}

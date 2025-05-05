package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

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
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
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
							Type:     github.Ptr("file"),
							Name:     github.Ptr("test.txt"),
							Path:     github.Ptr("test.txt"),
							Content:  github.Ptr("dGVzdCBjb250ZW50"), // base64 encoded "test content"
							Encoding: github.Ptr("base64"),
							Size:     github.Ptr(12),
							SHA:      github.Ptr("abc123"),
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
								Type: github.Ptr("file"),
								Name: github.Ptr("file1.txt"),
								Path: github.Ptr("dir/file1.txt"),
								Size: github.Ptr(100),
								SHA:  github.Ptr("abc123"),
							},
							{
								Type: github.Ptr("dir"),
								Name: github.Ptr("subdir"),
								Path: github.Ptr("dir/subdir"),
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
							Type:     github.Ptr("file"),
							Name:     github.Ptr("large.txt"),
							Path:     github.Ptr("large.txt"),
							Content:  github.Ptr(""),
							Encoding: github.Ptr("base64"),
							Size:     github.Ptr(maxFileSize + 1), // Exceeds max file size
							SHA:      github.Ptr("abc123"),
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
						_, err := w.Write([]byte("not a github error"))
						require.NoError(t, err)
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

func TestGithubClient_GetTree(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		basePath    string
		ref         string
		recursive   bool
		wantItems   int
		wantTrunc   bool
		wantErr     error
	}{
		{
			name: "get tree successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						tree := &github.Tree{
							SHA: github.Ptr("abc123"),
							Entries: []*github.TreeEntry{
								{
									Path: github.Ptr("file1.txt"),
									Mode: github.Ptr("100644"),
									Type: github.Ptr("blob"),
									Size: github.Ptr(12),
									SHA:  github.Ptr("file1sha"),
								},
								{
									Path: github.Ptr("file2.txt"),
									Mode: github.Ptr("100644"),
									Type: github.Ptr("blob"),
									Size: github.Ptr(14),
									SHA:  github.Ptr("file2sha"),
								},
								{
									Path: github.Ptr("dir"),
									Mode: github.Ptr("040000"),
									Type: github.Ptr("tree"),
									SHA:  github.Ptr("dirsha"),
								},
							},
							Truncated: github.Ptr(false),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(tree))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "",
			ref:        "main",
			recursive:  false,
			wantItems:  3,
			wantTrunc:  false,
			wantErr:    nil,
		},
		{
			name: "get tree with subpath",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Check if this is the first request for the root tree
						if !strings.Contains(r.URL.Path, "subdirsha") {
							// Verify the request URL contains the correct owner, repo, and ref
							expectedPath := "/repos/test-owner/test-repo/git/trees/main"
							assert.True(t, strings.Contains(r.URL.Path, expectedPath),
								"Expected URL path to contain %s, got %s", expectedPath, r.URL.Path)

							// Verify query parameters for recursive flag
							query := r.URL.Query()
							assert.Equal(t, "", query.Get("recursive"), "Recursive parameter should not be set")
						} else {
							// This is the second request for the subtree
							assert.True(t, strings.Contains(r.URL.Path, "subdirsha"),
								"Expected URL path to contain subdirsha, got %s", r.URL.Path)
						}
						// First request for the root tree
						tree := &github.Tree{
							SHA: github.Ptr("rootsha"),
							Entries: []*github.TreeEntry{
								{
									Path: github.Ptr("subdir"),
									Mode: github.Ptr("040000"),
									Type: github.Ptr("tree"),
									SHA:  github.Ptr("subdirsha"),
								},
							},
							Truncated: github.Ptr(false),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(tree))
					}),
				),
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Second request for the subdir tree
						if strings.Contains(r.URL.Path, "subdirsha") {
							tree := &github.Tree{
								SHA: github.Ptr("subdirsha"),
								Entries: []*github.TreeEntry{
									{
										Path: github.Ptr("file3.txt"),
										Mode: github.Ptr("100644"),
										Type: github.Ptr("blob"),
										Size: github.Ptr(16),
										SHA:  github.Ptr("file3sha"),
									},
								},
								Truncated: github.Ptr(false),
							}
							w.WriteHeader(http.StatusOK)
							require.NoError(t, json.NewEncoder(w).Encode(tree))
						}
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "subdir",
			ref:        "main",
			recursive:  false,
			wantItems:  1,
			wantTrunc:  false,
			wantErr:    nil,
		},
		{
			name: "subpath not found should pretend is empty",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// First request for the root tree
						if !strings.Contains(r.URL.Path, "nonexistentsha") {
							tree := &github.Tree{
								SHA: github.Ptr("rootsha"),
								Entries: []*github.TreeEntry{
									{
										Path: github.Ptr("nonexistent"),
										Mode: github.Ptr("040000"),
										Type: github.Ptr("tree"),
										SHA:  github.Ptr("nonexistentsha"),
									},
								},
								Truncated: github.Ptr(false),
							}
							w.WriteHeader(http.StatusOK)
							require.NoError(t, json.NewEncoder(w).Encode(tree))
						} else {
							// Second request for the nonexistent subtree returns 404
							w.WriteHeader(http.StatusNotFound)
							require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
								Response: &http.Response{
									StatusCode: http.StatusNotFound,
								},
								Message: "Not Found",
							}))
						}
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "nonexistent",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
			wantErr:    nil,
		},
		{
			name: "get tree fails with service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
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
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "tree contains too many items",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Create more entries than the maxTreeItems limit
						entries := make([]*github.TreeEntry, maxTreeItems+1)
						for i := 0; i < maxTreeItems+1; i++ {
							entries[i] = &github.TreeEntry{
								Path: github.Ptr(fmt.Sprintf("file%d.txt", i+1)),
								Mode: github.Ptr("100644"),
								Type: github.Ptr("blob"),
								Size: github.Ptr(12),
								SHA:  github.Ptr(fmt.Sprintf("sha%d", i+1)),
							}
						}

						tree := &github.Tree{
							SHA:       github.Ptr("abc123"),
							Entries:   entries,
							Truncated: github.Ptr(false),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(tree))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
			wantErr:    fmt.Errorf("tree contains too many items (more than %d)", maxTreeItems),
		},

		{
			name: "tree is truncated with recursive mode",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						tree := &github.Tree{
							SHA: github.Ptr("abc123"),
							Entries: []*github.TreeEntry{
								{
									Path: github.Ptr("file1.txt"),
									Mode: github.Ptr("100644"),
									Type: github.Ptr("blob"),
									Size: github.Ptr(12),
									SHA:  github.Ptr("file1sha"),
								},
							},
							Truncated: github.Ptr(true),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(tree))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "",
			ref:        "main",
			recursive:  true,
			wantItems:  0,
			wantTrunc:  true,
			wantErr:    fmt.Errorf("tree is too large to fetch recursively (more than 10000 items)"),
		},
		{
			name: "repository not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
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
			owner:      "test-owner",
			repository: "non-existent-repo",
			basePath:   "",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
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
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "too many items in tree",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Create a tree with more than maxTreeItems entries
						entries := make([]*github.TreeEntry, maxTreeItems+1)
						for i := 0; i < maxTreeItems+1; i++ {
							entries[i] = &github.TreeEntry{
								Path: github.Ptr(fmt.Sprintf("file%d.txt", i)),
								Mode: github.Ptr("100644"),
								Type: github.Ptr("blob"),
								Size: github.Ptr(12),
								SHA:  github.Ptr(fmt.Sprintf("sha%d", i)),
							}
						}
						tree := &github.Tree{
							SHA:       github.Ptr("abc123"),
							Entries:   entries,
							Truncated: github.Ptr(false),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(tree))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
			wantErr:    fmt.Errorf("tree contains too many items (more than 10000)"),
		},
		{
			name: "folder not found in tree",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Return a tree that doesn't contain the requested folder
						tree := &github.Tree{
							SHA: github.Ptr("rootsha"),
							Entries: []*github.TreeEntry{
								{
									Path: github.Ptr("other-folder"),
									Mode: github.Ptr("040000"),
									Type: github.Ptr("tree"),
									SHA:  github.Ptr("othersha"),
								},
								{
									Path: github.Ptr("file.txt"),
									Mode: github.Ptr("100644"),
									Type: github.Ptr("blob"),
									Size: github.Ptr(12),
									SHA:  github.Ptr("filesha"),
								},
							},
							Truncated: github.Ptr(false),
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(tree))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			basePath:   "non-existent-folder/subpath",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
			wantErr:    nil,
		},
		{
			name: "non-standard error is passed through",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposGitTreesByOwnerByRepoByTreeSha,
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
			basePath:   "",
			ref:        "main",
			recursive:  false,
			wantItems:  0,
			wantTrunc:  false,
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
			contents, truncated, err := client.GetTree(context.Background(), tt.owner, tt.repository, tt.basePath, tt.ref, tt.recursive)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr.Error())
				assert.Nil(t, contents)
				return
			}
			assert.NoError(t, err)

			// Check truncated flag
			assert.Equal(t, tt.wantTrunc, truncated)

			// Check the result
			if tt.wantItems > 0 {
				assert.NotNil(t, contents)
				assert.Equal(t, tt.wantItems, len(contents))
			} else {
				assert.Empty(t, contents)
			}
		})
	}
}

func TestGithubClient_CreateFile(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		path        string
		branch      string
		message     string
		content     []byte
		wantErr     error
	}{
		{
			name: "create file successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						response := &github.RepositoryContentResponse{
							Content: &github.RepositoryContent{
								Name: github.Ptr("test.txt"),
								Path: github.Ptr("test.txt"),
								SHA:  github.Ptr("abc123"),
							},
						}
						w.WriteHeader(http.StatusCreated)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Add test.txt",
			content:    []byte("test content"),
			wantErr:    nil,
		},
		{
			name: "file already exists",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusUnprocessableEntity)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusUnprocessableEntity,
							},
							Message: "File already exists",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "existing.txt",
			branch:     "main",
			message:    "Add existing.txt",
			content:    []byte("test content"),
			wantErr:    ErrResourceAlreadyExists,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
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
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Add test.txt",
			content:    []byte("test content"),
			wantErr:    errors.New("Service unavailable"),
		},
		{
			name: "not a github error response",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusInternalServerError)
						_, err := w.Write([]byte("not a github error"))
						require.NoError(t, err)
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Add test.txt",
			content:    []byte("test content"),
			wantErr:    errors.New("500"),
		},
		{
			name: "default commit message",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Decode the request to verify the message
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						var reqData struct {
							Message string `json:"message"`
						}
						require.NoError(t, json.Unmarshal(body, &reqData))
						assert.Equal(t, "Create test.txt", reqData.Message)

						response := &github.RepositoryContentResponse{
							Content: &github.RepositoryContent{
								Name: github.Ptr("test.txt"),
								Path: github.Ptr("test.txt"),
								SHA:  github.Ptr("abc123"),
							},
						}
						w.WriteHeader(http.StatusCreated)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "", // Empty message should use default
			content:    []byte("test content"),
			wantErr:    nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.CreateFile(context.Background(), tt.owner, tt.repository, tt.path, tt.branch, tt.message, tt.content)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr.Error())
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestUpdateFile(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		path        string
		branch      string
		message     string
		hash        string
		content     []byte
		wantErr     error
	}{
		{
			name: "successful update",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Verify request body
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						var reqData struct {
							Message string `json:"message"`
							SHA     string `json:"sha"`
						}
						require.NoError(t, json.Unmarshal(body, &reqData))
						assert.Equal(t, "Update test.txt", reqData.Message)
						assert.Equal(t, "abc123", reqData.SHA)

						response := &github.RepositoryContentResponse{
							Content: &github.RepositoryContent{
								Name: github.Ptr("test.txt"),
								Path: github.Ptr("test.txt"),
								SHA:  github.Ptr("def456"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "", // Empty message should use default
			hash:       "abc123",
			content:    []byte("updated content"),
			wantErr:    nil,
		},
		{
			name: "file not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Not Found"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "nonexistent.txt",
			branch:     "main",
			message:    "Update nonexistent file",
			hash:       "abc123",
			content:    []byte("content"),
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "mismatched hash",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusConflict)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "SHA mismatch"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Update with wrong hash",
			hash:       "wrong-hash",
			content:    []byte("content"),
			wantErr:    ErrMismatchedHash,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Service unavailable"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Update during outage",
			hash:       "abc123",
			content:    []byte("content"),
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PutReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusInternalServerError)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Internal server error"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Update with server error",
			hash:       "abc123",
			content:    []byte("content"),
			wantErr:    errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.UpdateFile(context.Background(), tt.owner, tt.repository, tt.path, tt.branch, tt.message, tt.hash, tt.content)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGithubClient_DeleteFile(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		path        string
		branch      string
		message     string
		hash        string
		wantErr     error
	}{
		{
			name: "delete file successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						response := &github.RepositoryContentResponse{
							Content: nil,
							Commit: github.Commit{
								SHA: github.Ptr("def456"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Delete test.txt",
			hash:       "abc123",
			wantErr:    nil,
		},
		{
			name: "file not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposContentsByOwnerByRepoByPath,
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
			owner:      "test-owner",
			repository: "test-repo",
			path:       "nonexistent.txt",
			branch:     "main",
			message:    "Delete nonexistent.txt",
			hash:       "abc123",
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "mismatched hash",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusConflict)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusConflict,
							},
							Message: "Conflict",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Delete test.txt",
			hash:       "wrong-hash",
			wantErr:    ErrMismatchedHash,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposContentsByOwnerByRepoByPath,
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
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Delete test.txt",
			hash:       "abc123",
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusInternalServerError)
						require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"message": "Internal server error"}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "Delete with server error",
			hash:       "abc123",
			wantErr:    errors.New("Internal server error"),
		},
		{
			name: "default commit message",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposContentsByOwnerByRepoByPath,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Decode the request to verify the message
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						var reqData struct {
							Message string `json:"message"`
						}
						require.NoError(t, json.Unmarshal(body, &reqData))
						assert.Equal(t, "Delete test.txt", reqData.Message)

						response := &github.RepositoryContentResponse{
							Content: nil,
							Commit: github.Commit{
								SHA: github.Ptr("def456"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(response))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			path:       "test.txt",
			branch:     "main",
			message:    "",
			hash:       "abc123",
			wantErr:    nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.DeleteFile(context.Background(), tt.owner, tt.repository, tt.path, tt.branch, tt.message, tt.hash)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGithubClient_GetCommits(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		branch      string
		path        string
		since       time.Time
		until       time.Time
		wantCommits []Commit
		wantErr     error
	}{
		{
			name: "get commits successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCommitsByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						commits := []*github.RepositoryCommit{
							{
								SHA: github.Ptr("abc123"),
								Commit: &github.Commit{
									Message: github.Ptr("First commit"),
									Author: &github.CommitAuthor{
										Name:  github.Ptr("Test User"),
										Email: github.Ptr("test@example.com"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)},
									},
									Committer: &github.CommitAuthor{
										Name:  github.Ptr("Test User"),
										Email: github.Ptr("test@example.com"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)},
									},
								},
								Author: &github.User{
									Login:     github.Ptr("test-user"),
									AvatarURL: github.Ptr("https://avatar.url"),
								},
								Committer: &github.User{
									Login:     github.Ptr("test-user"),
									AvatarURL: github.Ptr("https://avatar.url"),
								},
							},
							{
								SHA: github.Ptr("def456"),
								Commit: &github.Commit{
									Message: github.Ptr("Second commit"),
									Author: &github.CommitAuthor{
										Name:  github.Ptr("Another User"),
										Email: github.Ptr("another@example.com"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 2, 12, 0, 0, 0, time.UTC)},
									},
									Committer: &github.CommitAuthor{
										Name:  github.Ptr("Another User"),
										Email: github.Ptr("another@example.com"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 2, 12, 0, 0, 0, time.UTC)},
									},
								},
								Author: &github.User{
									Login:     github.Ptr("another-user"),
									AvatarURL: github.Ptr("https://another.avatar.url"),
								},
								Committer: &github.User{
									Login:     github.Ptr("another-user"),
									AvatarURL: github.Ptr("https://another.avatar.url"),
								},
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(commits))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			branch:     "main",
			path:       "test.txt",
			since:      time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			until:      time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
			wantCommits: []Commit{
				{
					Ref:     "abc123",
					Message: "First commit",
					Author: &CommitAuthor{
						Name:      "Test User",
						Username:  "test-user",
						AvatarURL: "https://avatar.url",
					},
					Committer: &CommitAuthor{
						Name:      "Test User",
						Username:  "test-user",
						AvatarURL: "https://avatar.url",
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
				},
				{
					Ref:     "def456",
					Message: "Second commit",
					Author: &CommitAuthor{
						Name:      "Another User",
						Username:  "another-user",
						AvatarURL: "https://another.avatar.url",
					},
					Committer: &CommitAuthor{
						Name:      "Another User",
						Username:  "another-user",
						AvatarURL: "https://another.avatar.url",
					},
					CreatedAt: time.Date(2023, 1, 2, 12, 0, 0, 0, time.UTC),
				},
			},
			wantErr: nil,
		},
		{
			name: "repository not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCommitsByOwnerByRepo,
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
			owner:       "test-owner",
			repository:  "nonexistent-repo",
			branch:      "main",
			path:        "test.txt",
			since:       time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			until:       time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
			wantCommits: nil,
			wantErr:     ErrResourceNotFound,
		},
		{
			name: "commits missing author",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCommitsByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						commits := []*github.RepositoryCommit{
							{
								SHA: github.Ptr("abc123"),
								Commit: &github.Commit{
									Message: github.Ptr("First commit"),
									Author: &github.CommitAuthor{
										Name:  github.Ptr("Test User"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)},
										Email: github.Ptr("test@example.com"),
									},
									Committer: &github.CommitAuthor{
										Name:  github.Ptr("Test User"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)},
										Email: github.Ptr("test@example.com"),
									},
								},
								// Author is nil
								Committer: &github.User{
									Login:     github.Ptr("test-user"),
									AvatarURL: github.Ptr("https://avatar.url"),
								},
							},
							{
								SHA: github.Ptr("def456"),
								Commit: &github.Commit{
									Message: github.Ptr("Second commit"),
									// Missing Author in Commit
									Committer: &github.CommitAuthor{
										Name:  github.Ptr("Another User"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 2, 12, 0, 0, 0, time.UTC)},
										Email: github.Ptr("another@example.com"),
									},
								},
								Author: &github.User{
									Login:     github.Ptr("another-user"),
									AvatarURL: github.Ptr("https://another.avatar.url"),
								},
								Committer: &github.User{
									Login:     github.Ptr("another-user"),
									AvatarURL: github.Ptr("https://another.avatar.url"),
								},
							},
						}
						require.NoError(t, json.NewEncoder(w).Encode(commits))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			branch:     "main",
			path:       "test.txt",
			since:      time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			until:      time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
			wantCommits: []Commit{
				{
					Ref:     "abc123",
					Message: "First commit",
					Author: &CommitAuthor{
						Name: "Test User",
						// Username and AvatarURL are empty because Author is nil in the response
					},
					Committer: &CommitAuthor{
						Name:      "Test User",
						Username:  "test-user",
						AvatarURL: "https://avatar.url",
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
				},
				{
					Ref:     "def456",
					Message: "Second commit",
					Author:  nil, // Author is nil because Commit.Author is nil in the response
					Committer: &CommitAuthor{
						Name:      "Another User",
						Username:  "another-user",
						AvatarURL: "https://another.avatar.url",
					},
				},
			},
			wantErr: nil,
		},
		{
			name: "too many commits",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCommitsByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Return a large number of commits that would exceed the maxCommits limit
						commits := make([]*github.RepositoryCommit, maxCommits+1)
						for i := 0; i < maxCommits+1; i++ {
							commits[i] = &github.RepositoryCommit{
								SHA: github.Ptr(fmt.Sprintf("commit%d", i)),
								Commit: &github.Commit{
									Message: github.Ptr(fmt.Sprintf("Commit %d", i)),
									Author: &github.CommitAuthor{
										Name:  github.Ptr("Test User"),
										Date:  &github.Timestamp{Time: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)},
										Email: github.Ptr("test@example.com"),
									},
								},
								Author: &github.User{
									Login:     github.Ptr("test-user"),
									AvatarURL: github.Ptr("https://avatar.url"),
								},
							}
						}
						require.NoError(t, json.NewEncoder(w).Encode(commits))
					}),
				),
			),
			owner:       "test-owner",
			repository:  "test-repo",
			branch:      "main",
			path:        "test.txt",
			since:       time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			until:       time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
			wantCommits: nil,
			wantErr:     fmt.Errorf("too many commits to fetch (more than %d)", maxCommits),
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCommitsByOwnerByRepo,
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
			owner:       "test-owner",
			repository:  "test-repo",
			branch:      "main",
			path:        "test.txt",
			since:       time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			until:       time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
			wantCommits: nil,
			wantErr:     ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCommitsByOwnerByRepo,
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
			owner:       "test-owner",
			repository:  "test-repo",
			branch:      "main",
			path:        "test.txt",
			since:       time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			until:       time.Date(2023, 1, 3, 0, 0, 0, 0, time.UTC),
			wantCommits: nil,
			wantErr:     errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			commits, err := client.Commits(context.Background(), tt.owner, tt.repository, tt.branch, tt.path)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
				assert.Nil(t, commits)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantCommits, commits)
			}
		})
	}
}

func TestCompareCommits(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		base        string
		head        string
		wantFiles   []CommitFile
		wantErr     error
	}{
		{
			name: "successful comparison",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCompareByOwnerByRepoByBasehead,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						files := []*github.CommitFile{
							{
								Filename:  github.Ptr("file1.txt"),
								Status:    github.Ptr("modified"),
								Additions: github.Ptr(10),
								Deletions: github.Ptr(5),
								Changes:   github.Ptr(15),
							},
							{
								Filename:  github.Ptr("file2.txt"),
								Status:    github.Ptr("added"),
								Additions: github.Ptr(20),
								Deletions: github.Ptr(0),
								Changes:   github.Ptr(20),
							},
						}

						require.NoError(t, json.NewEncoder(w).Encode(github.CommitsComparison{
							Files: files,
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			base:       "main",
			head:       "feature-branch",
			wantFiles: []CommitFile{
				&github.CommitFile{
					Filename:  github.Ptr("file1.txt"),
					Status:    github.Ptr("modified"),
					Additions: github.Ptr(10),
					Deletions: github.Ptr(5),
					Changes:   github.Ptr(15),
				},
				&github.CommitFile{
					Filename:  github.Ptr("file2.txt"),
					Status:    github.Ptr("added"),
					Additions: github.Ptr(20),
					Deletions: github.Ptr(0),
					Changes:   github.Ptr(20),
				},
			},
			wantErr: nil,
		},
		{
			name: "too many files",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCompareByOwnerByRepoByBasehead,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Generate more files than the max limit
						files := make([]*github.CommitFile, maxCompareFiles+1)
						for i := 0; i < maxCompareFiles+1; i++ {
							files[i] = &github.CommitFile{
								Filename: github.Ptr(fmt.Sprintf("file%d.txt", i)),
								Status:   github.Ptr("modified"),
							}
						}

						require.NoError(t, json.NewEncoder(w).Encode(github.CommitsComparison{
							Files: files,
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			base:       "main",
			head:       "feature-branch",
			wantFiles:  nil,
			wantErr:    fmt.Errorf("too many files changed between commits (more than %d)", maxCompareFiles),
		},
		{
			name: "resource not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCompareByOwnerByRepoByBasehead,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusNotFound,
							},
							Message: "Not found",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			base:       "main",
			head:       "feature-branch",
			wantFiles:  nil,
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCompareByOwnerByRepoByBasehead,
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
			owner:      "test-owner",
			repository: "test-repo",
			base:       "main",
			head:       "feature-branch",
			wantFiles:  nil,
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposCompareByOwnerByRepoByBasehead,
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
			owner:      "test-owner",
			repository: "test-repo",
			base:       "main",
			head:       "feature-branch",
			wantFiles:  nil,
			wantErr:    errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			files, err := client.CompareCommits(context.Background(), tt.owner, tt.repository, tt.base, tt.head)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
				assert.Nil(t, files)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantFiles, files)
			}
		})
	}
}

func TestGetBranch(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		branchName  string
		wantBranch  Branch
		wantErr     error
	}{
		{
			name: "get branch successfully",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						branch := &github.Branch{
							Name: github.Ptr("main"),
							Commit: &github.RepositoryCommit{
								SHA: github.Ptr("abc123"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(branch))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			branchName: "main",
			wantBranch: Branch{
				Name: "main",
				Sha:  "abc123",
			},
			wantErr: nil,
		},
		{
			name: "branch not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusNotFound,
							},
							Message: "Branch not found",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			branchName: "non-existent",
			wantBranch: Branch{},
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
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
			owner:      "test-owner",
			repository: "test-repo",
			branchName: "main",
			wantBranch: Branch{},
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
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
			owner:      "test-owner",
			repository: "test-repo",
			branchName: "main",
			wantBranch: Branch{},
			wantErr:    errors.New("unexpected status code: 500 Internal Server Error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			branch, err := client.GetBranch(context.Background(), tt.owner, tt.repository, tt.branchName)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
				assert.Equal(t, tt.wantBranch, branch)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantBranch, branch)
			}
		})
	}
}

func TestGithubClient_CreateBranch(t *testing.T) {
	tests := []struct {
		name         string
		mockHandler  *http.Client
		owner        string
		repository   string
		sourceBranch string
		branchName   string
		wantErr      error
	}{
		{
			name: "successful branch creation",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// First call checks if branch exists (should return 404)
						if strings.Contains(r.URL.Path, "/new-branch") {
							w.WriteHeader(http.StatusNotFound)
							return
						}

						// Second call gets the source branch
						if strings.Contains(r.URL.Path, "/main") {
							branch := &github.Branch{
								Name: github.Ptr("main"),
								Commit: &github.RepositoryCommit{
									SHA: github.Ptr("abc123"),
								},
							}
							w.WriteHeader(http.StatusOK)
							require.NoError(t, json.NewEncoder(w).Encode(branch))
						}
					}),
				),
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposGitRefsByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Verify the request body contains the correct reference
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)
						ref := struct {
							Ref string `json:"ref"`
							SHA string `json:"sha"`
						}{}
						require.NoError(t, json.Unmarshal(body, &ref))
						assert.Equal(t, "refs/heads/new-branch", ref.Ref)
						assert.Equal(t, "abc123", ref.SHA)

						w.WriteHeader(http.StatusCreated)
						require.NoError(t, json.NewEncoder(w).Encode(&github.Reference{
							Ref: github.Ptr("refs/heads/new-branch"),
							Object: &github.GitObject{
								SHA: github.Ptr("abc123"),
							},
						}))
					}),
				),
			),
			owner:        "test-owner",
			repository:   "test-repo",
			sourceBranch: "main",
			branchName:   "new-branch",
			wantErr:      nil,
		},
		{
			name: "branch already exists",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Verify the request URL contains the correct owner, repo, and branch
						expectedPath := "/repos/test-owner/test-repo/branches/existing-branch"
						assert.True(t, strings.Contains(r.URL.Path, expectedPath),
							"Expected URL path to contain %s, got %s", expectedPath, r.URL.Path)
						// Branch exists check returns success
						branch := &github.Branch{
							Name: github.Ptr("existing-branch"),
							Commit: &github.RepositoryCommit{
								SHA: github.Ptr("abc123"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(branch))
					}),
				),
			),
			owner:        "test-owner",
			repository:   "test-repo",
			sourceBranch: "main",
			branchName:   "existing-branch",
			wantErr:      ErrResourceAlreadyExists,
		},
		{
			name: "source branch not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// First call checks if branch exists (should return 404)
						if strings.Contains(r.URL.Path, "/new-branch") {
							w.WriteHeader(http.StatusNotFound)
							return
						}

						// Second call gets the source branch (not found)
						if strings.Contains(r.URL.Path, "/nonexistent") {
							w.WriteHeader(http.StatusNotFound)
							require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
								Response: &http.Response{
									StatusCode: http.StatusNotFound,
								},
								Message: "Branch not found",
							}))
						}
					}),
				),
			),
			owner:        "test-owner",
			repository:   "test-repo",
			sourceBranch: "nonexistent",
			branchName:   "new-branch",
			wantErr:      errors.New("get base branch"),
		},
		{
			name: "error creating branch ref",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// First call checks if branch exists (should return 404)
						if strings.Contains(r.URL.Path, "/new-branch") {
							w.WriteHeader(http.StatusNotFound)
							return
						}

						// Second call gets the source branch
						if strings.Contains(r.URL.Path, "/main") {
							branch := &github.Branch{
								Name: github.Ptr("main"),
								Commit: &github.RepositoryCommit{
									SHA: github.Ptr("abc123"),
								},
							}
							w.WriteHeader(http.StatusOK)
							require.NoError(t, json.NewEncoder(w).Encode(branch))
						}
					}),
				),
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposGitRefsByOwnerByRepo,
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
			owner:        "test-owner",
			repository:   "test-repo",
			sourceBranch: "main",
			branchName:   "new-branch",
			wantErr:      errors.New("create branch ref"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.CreateBranch(context.Background(), tt.owner, tt.repository, tt.sourceBranch, tt.branchName)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGithubClient_BranchExists(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		branchName  string
		want        bool
		wantErr     bool
	}{
		{
			name: "branch exists",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						branch := &github.Branch{
							Name: github.Ptr("existing-branch"),
							Commit: &github.RepositoryCommit{
								SHA: github.Ptr("abc123"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(branch))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			branchName: "existing-branch",
			want:       true,
			wantErr:    false,
		},
		{
			name: "branch does not exist",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusNotFound,
							},
							Message: "Branch not found",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			branchName: "non-existent-branch",
			want:       false,
			wantErr:    false,
		},
		{
			name: "error response",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposBranchesByOwnerByRepoByBranch,
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
			owner:      "test-owner",
			repository: "test-repo",
			branchName: "some-branch",
			want:       false,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			got, err := client.BranchExists(context.Background(), tt.owner, tt.repository, tt.branchName)

			// Check the error
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			assert.Equal(t, tt.want, got)
		})
	}
}
func TestGithubClient_ListWebhooks(t *testing.T) {
	tests := []struct {
		name         string
		mockHandler  *http.Client
		owner        string
		repository   string
		wantWebhooks []WebhookConfig
		wantErr      error
	}{
		{
			name: "successful webhooks listing",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						hooks := []*github.Hook{
							{
								ID:     github.Ptr(int64(1)),
								Events: []string{"push", "pull_request"},
								Active: github.Ptr(true),
								Config: &github.HookConfig{
									URL:         github.Ptr("https://example.com/webhook1"),
									ContentType: github.Ptr("json"),
								},
							},
							{
								ID:     github.Ptr(int64(2)),
								Events: []string{"issues"},
								Active: github.Ptr(false),
								Config: &github.HookConfig{
									URL:         github.Ptr("https://example.com/webhook2"),
									ContentType: github.Ptr(""),
								},
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(hooks))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			wantWebhooks: []WebhookConfig{
				{
					ID:          1,
					Events:      []string{"push", "pull_request"},
					Active:      true,
					URL:         "https://example.com/webhook1",
					ContentType: "json",
				},
				{
					ID:          2,
					Events:      []string{"issues"},
					Active:      false,
					URL:         "https://example.com/webhook2",
					ContentType: "form", // Default value when empty
				},
			},
			wantErr: nil,
		},
		{
			name: "empty webhooks list",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						hooks := []*github.Hook{}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(hooks))
					}),
				),
			),
			owner:        "test-owner",
			repository:   "test-repo",
			wantWebhooks: []WebhookConfig{},
			wantErr:      nil,
		},
		{
			name: "too many webhooks",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Create more webhooks than the maxWebhooks limit
						hooks := make([]*github.Hook, maxWebhooks+1)
						for i := 0; i < maxWebhooks+1; i++ {
							hooks[i] = &github.Hook{
								ID:     github.Ptr(int64(i + 1)),
								Events: []string{"push"},
								Active: github.Ptr(true),
								Config: &github.HookConfig{
									URL:         github.Ptr(fmt.Sprintf("https://example.com/webhook%d", i+1)),
									ContentType: github.Ptr("json"),
								},
							}
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(hooks))
					}),
				),
			),
			owner:        "test-owner",
			repository:   "test-repo",
			wantWebhooks: nil,
			wantErr:      fmt.Errorf("too many webhooks configured (more than %d)", maxWebhooks),
		},
		{
			name: "service unavailable error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepo,
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
			owner:        "test-owner",
			repository:   "test-repo",
			wantWebhooks: nil,
			wantErr:      ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepo,
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
			owner:        "test-owner",
			repository:   "test-repo",
			wantWebhooks: nil,
			wantErr:      errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			webhooks, err := client.ListWebhooks(context.Background(), tt.owner, tt.repository)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			assert.Equal(t, tt.wantWebhooks, webhooks)
		})
	}
}

func TestGithubClient_CreateWebhook(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		config      WebhookConfig
		want        WebhookConfig
		wantErr     error
	}{
		{
			name: "successful webhook creation",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposHooksByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Verify the request body contains the correct webhook config
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						hook := &github.Hook{}
						require.NoError(t, json.Unmarshal(body, hook))

						assert.Equal(t, "https://example.com/webhook", hook.Config.GetURL())
						assert.Equal(t, "json", hook.Config.GetContentType())
						assert.Equal(t, "secret123", hook.Config.GetSecret())
						assert.Equal(t, []string{"push", "pull_request"}, hook.Events)
						assert.True(t, hook.GetActive())

						// Return a created hook
						createdHook := &github.Hook{
							ID:     github.Ptr(int64(123)),
							Events: []string{"push", "pull_request"},
							Active: github.Ptr(true),
							Config: &github.HookConfig{
								URL:         github.Ptr("https://example.com/webhook"),
								ContentType: github.Ptr("json"),
								// Secret is not returned by GitHub API
							},
						}

						w.WriteHeader(http.StatusCreated)
						require.NoError(t, json.NewEncoder(w).Encode(createdHook))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				Events:      []string{"push", "pull_request"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "json",
				Secret:      "secret123",
			},
			want: WebhookConfig{
				ID:          123,
				Events:      []string{"push", "pull_request"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "json",
				Secret:      "secret123",
			},
			wantErr: nil,
		},
		{
			name: "default content type to form",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposHooksByOwnerByRepo,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						hook := &github.Hook{}
						require.NoError(t, json.Unmarshal(body, hook))

						// Verify content type was defaulted to "form"
						assert.Equal(t, "form", hook.Config.GetContentType())

						createdHook := &github.Hook{
							ID:     github.Ptr(int64(123)),
							Events: []string{"push"},
							Active: github.Ptr(true),
							Config: &github.HookConfig{
								URL:         github.Ptr("https://example.com/webhook"),
								ContentType: github.Ptr("form"),
							},
						}

						w.WriteHeader(http.StatusCreated)
						require.NoError(t, json.NewEncoder(w).Encode(createdHook))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				Events: []string{"push"},
				Active: true,
				URL:    "https://example.com/webhook",
				Secret: "secret123",
				// ContentType intentionally omitted
			},
			want: WebhookConfig{
				ID:          123,
				Events:      []string{"push"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "form",
				Secret:      "secret123",
			},
			wantErr: nil,
		},
		{
			name: "service unavailable error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposHooksByOwnerByRepo,
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
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				Events:      []string{"push"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "json",
				Secret:      "secret123",
			},
			want:    WebhookConfig{},
			wantErr: ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposHooksByOwnerByRepo,
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
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				Events:      []string{"push"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "json",
				Secret:      "secret123",
			},
			want:    WebhookConfig{},
			wantErr: errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			got, err := client.CreateWebhook(context.Background(), tt.owner, tt.repository, tt.config)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGithubClient_GetWebhook(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		webhookID   int64
		want        WebhookConfig
		wantErr     error
	}{
		{
			name: "successful webhook retrieval",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepoByHookId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						hook := &github.Hook{
							ID:     github.Ptr(int64(123)),
							Events: []string{"push", "pull_request"},
							Active: github.Ptr(true),
							Config: &github.HookConfig{
								URL:         github.Ptr("https://example.com/webhook"),
								ContentType: github.Ptr("json"),
								// Secret is not returned by GitHub API
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(hook))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  123,
			want: WebhookConfig{
				ID:          123,
				Events:      []string{"push", "pull_request"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "json",
			},
			wantErr: nil,
		},

		{
			name: "empty content type defaults to json",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepoByHookId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						hook := &github.Hook{
							ID:     github.Ptr(int64(456)),
							Events: []string{"push"},
							Active: github.Ptr(true),
							Config: &github.HookConfig{
								URL:         github.Ptr("https://example.com/webhook-empty-content"),
								ContentType: github.Ptr(""), // Empty content type
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(hook))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  456,
			want: WebhookConfig{
				ID:          456,
				Events:      []string{"push"},
				Active:      true,
				URL:         "https://example.com/webhook-empty-content",
				ContentType: "json", // Should default to "json"
			},
			wantErr: nil,
		},
		{
			name: "webhook not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepoByHookId,
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
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  999,
			want:       WebhookConfig{},
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepoByHookId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusServiceUnavailable)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusServiceUnavailable,
							},
							Message: "Service Unavailable",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  123,
			want:       WebhookConfig{},
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposHooksByOwnerByRepoByHookId,
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
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  123,
			want:       WebhookConfig{},
			wantErr:    errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			got, err := client.GetWebhook(context.Background(), tt.owner, tt.repository, tt.webhookID)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGithubClient_DeleteWebhook(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		webhookID   int64
		wantErr     error
	}{
		{
			name: "successful webhook deletion",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposHooksByOwnerByRepoByHookId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNoContent)
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  123,
			wantErr:    nil,
		},
		{
			name: "webhook not found",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposHooksByOwnerByRepoByHookId,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						w.WriteHeader(http.StatusNotFound)
						require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
							Response: &http.Response{
								StatusCode: http.StatusNotFound,
							},
							Message: "Not found",
						}))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  456,
			wantErr:    ErrResourceNotFound,
		},
		{
			name: "service unavailable",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposHooksByOwnerByRepoByHookId,
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
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  789,
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.DeleteReposHooksByOwnerByRepoByHookId,
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
			owner:      "test-owner",
			repository: "test-repo",
			webhookID:  101,
			wantErr:    errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.DeleteWebhook(context.Background(), tt.owner, tt.repository, tt.webhookID)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGithubClient_EditWebhook(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		config      WebhookConfig
		wantErr     error
	}{
		{
			name: "successful webhook edit",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PatchReposHooksByOwnerByRepoByHookId,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Verify the request body contains the correct webhook config
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						hook := &github.Hook{}
						require.NoError(t, json.Unmarshal(body, hook))

						assert.Equal(t, "https://example.com/webhook-updated", hook.Config.GetURL())
						assert.Equal(t, "json", hook.Config.GetContentType())
						assert.Equal(t, "updated-secret", hook.Config.GetSecret())
						assert.Equal(t, []string{"push", "pull_request", "issues"}, hook.Events)
						assert.True(t, hook.GetActive())

						// Return the updated hook
						updatedHook := &github.Hook{
							ID:     github.Ptr(int64(123)),
							Events: []string{"push", "pull_request", "issues"},
							Active: github.Ptr(true),
							Config: &github.HookConfig{
								URL:         github.Ptr("https://example.com/webhook-updated"),
								ContentType: github.Ptr("json"),
								// Secret is not returned by GitHub API
							},
						}

						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(updatedHook))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				ID:          123,
				Events:      []string{"push", "pull_request", "issues"},
				Active:      true,
				URL:         "https://example.com/webhook-updated",
				ContentType: "json",
				Secret:      "updated-secret",
			},
			wantErr: nil,
		},
		{
			name: "default content type to form",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PatchReposHooksByOwnerByRepoByHookId,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Verify the request body contains the correct webhook config
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						hook := &github.Hook{}
						require.NoError(t, json.Unmarshal(body, hook))

						// Verify content type was defaulted to "form"
						assert.Equal(t, "form", hook.Config.GetContentType())
						assert.Equal(t, "https://example.com/webhook", hook.Config.GetURL())
						assert.Equal(t, "secret123", hook.Config.GetSecret())
						assert.Equal(t, []string{"push"}, hook.Events)
						assert.True(t, hook.GetActive())

						// Return the updated hook
						updatedHook := &github.Hook{
							ID:     github.Ptr(int64(123)),
							Events: []string{"push"},
							Active: github.Ptr(true),
							Config: &github.HookConfig{
								URL:         github.Ptr("https://example.com/webhook"),
								ContentType: github.Ptr("form"),
								// Secret is not returned by GitHub API
							},
						}

						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(updatedHook))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				ID:          123,
				Events:      []string{"push"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "", // Empty content type should default to "form"
				Secret:      "secret123",
			},
			wantErr: nil,
		},
		{
			name: "service unavailable error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PatchReposHooksByOwnerByRepoByHookId,
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
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				ID:          123,
				Events:      []string{"push"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "json",
				Secret:      "secret123",
			},
			wantErr: ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PatchReposHooksByOwnerByRepoByHookId,
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
			owner:      "test-owner",
			repository: "test-repo",
			config: WebhookConfig{
				ID:          123,
				Events:      []string{"push"},
				Active:      true,
				URL:         "https://example.com/webhook",
				ContentType: "json",
				Secret:      "secret123",
			},
			wantErr: errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.EditWebhook(context.Background(), tt.owner, tt.repository, tt.config)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGithubClient_ListPullRequestFiles(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		number      int
		wantFiles   []CommitFile
		wantErr     error
	}{
		{
			name: "successful pull request files listing",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposPullsFilesByOwnerByRepoByPullNumber,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						files := []*github.CommitFile{
							{
								Filename:  github.Ptr("file1.txt"),
								Additions: github.Ptr(10),
								Deletions: github.Ptr(5),
								Changes:   github.Ptr(15),
								Status:    github.Ptr("modified"),
								Patch:     github.Ptr("@@ -1,5 +1,10 @@"),
							},
							{
								Filename:  github.Ptr("file2.txt"),
								Additions: github.Ptr(20),
								Deletions: github.Ptr(0),
								Changes:   github.Ptr(20),
								Status:    github.Ptr("added"),
								Patch:     github.Ptr("@@ -0,0 +1,20 @@"),
							},
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(files))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			number:     123,
			wantFiles: []CommitFile{
				&github.CommitFile{
					Filename:  github.Ptr("file1.txt"),
					Additions: github.Ptr(10),
					Deletions: github.Ptr(5),
					Changes:   github.Ptr(15),
					Status:    github.Ptr("modified"),
					Patch:     github.Ptr("@@ -1,5 +1,10 @@"),
				},
				&github.CommitFile{
					Filename:  github.Ptr("file2.txt"),
					Additions: github.Ptr(20),
					Deletions: github.Ptr(0),
					Changes:   github.Ptr(20),
					Status:    github.Ptr("added"),
					Patch:     github.Ptr("@@ -0,0 +1,20 @@"),
				},
			},
			wantErr: nil,
		},
		{
			name: "empty files list",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposPullsFilesByOwnerByRepoByPullNumber,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						files := []*github.CommitFile{}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(files))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			number:     456,
			wantFiles:  []CommitFile{},
			wantErr:    nil,
		},
		{
			name: "too many files",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposPullsFilesByOwnerByRepoByPullNumber,
					http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						// Create more files than the maxPRFiles limit
						files := make([]*github.CommitFile, maxPRFiles+1)
						for i := 0; i < maxPRFiles+1; i++ {
							files[i] = &github.CommitFile{
								Filename:  github.Ptr(fmt.Sprintf("file%d.txt", i+1)),
								Additions: github.Ptr(i + 1),
								Deletions: github.Ptr(0),
								Changes:   github.Ptr(i + 1),
								Status:    github.Ptr("added"),
							}
						}
						w.WriteHeader(http.StatusOK)
						require.NoError(t, json.NewEncoder(w).Encode(files))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			number:     789,
			wantFiles:  nil,
			wantErr:    fmt.Errorf("pull request contains too many files (more than %d)", maxPRFiles),
		},
		{
			name: "service unavailable error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposPullsFilesByOwnerByRepoByPullNumber,
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
			owner:      "test-owner",
			repository: "test-repo",
			number:     101,
			wantFiles:  nil,
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.GetReposPullsFilesByOwnerByRepoByPullNumber,
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
			owner:      "test-owner",
			repository: "test-repo",
			number:     202,
			wantFiles:  nil,
			wantErr:    errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			files, err := client.ListPullRequestFiles(context.Background(), tt.owner, tt.repository, tt.number)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			assert.Equal(t, tt.wantFiles, files)
		})
	}
}

func TestCreatePullRequestComment(t *testing.T) {
	tests := []struct {
		name        string
		mockHandler *http.Client
		owner       string
		repository  string
		number      int
		body        string
		wantErr     error
	}{
		{
			name: "successful comment creation",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposIssuesCommentsByOwnerByRepoByIssueNumber,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Verify the request body contains the correct comment
						body, err := io.ReadAll(r.Body)
						require.NoError(t, err)

						comment := &github.IssueComment{}
						require.NoError(t, json.Unmarshal(body, comment))
						assert.Equal(t, "Test comment", comment.GetBody())

						// Return the created comment
						createdComment := &github.IssueComment{
							ID:   github.Ptr(int64(123)),
							Body: github.Ptr("Test comment"),
						}

						w.WriteHeader(http.StatusCreated)
						require.NoError(t, json.NewEncoder(w).Encode(createdComment))
					}),
				),
			),
			owner:      "test-owner",
			repository: "test-repo",
			number:     101,
			body:       "Test comment",
			wantErr:    nil,
		},
		{
			name: "service unavailable error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposIssuesCommentsByOwnerByRepoByIssueNumber,
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
			owner:      "test-owner",
			repository: "test-repo",
			number:     101,
			body:       "Test comment",
			wantErr:    ErrServiceUnavailable,
		},
		{
			name: "other error",
			mockHandler: mockhub.NewMockedHTTPClient(
				mockhub.WithRequestMatchHandler(
					mockhub.PostReposIssuesCommentsByOwnerByRepoByIssueNumber,
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
			owner:      "test-owner",
			repository: "test-repo",
			number:     101,
			body:       "Test comment",
			wantErr:    errors.New("Internal server error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock client
			factory := ProvideFactory()
			factory.Client = tt.mockHandler
			client := factory.New(context.Background(), "")

			// Call the method being tested
			err := client.CreatePullRequestComment(context.Background(), tt.owner, tt.repository, tt.number, tt.body)

			// Check the error
			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPaginatedList(t *testing.T) {
	tests := []struct {
		name      string
		mockSetup func() (func(context.Context, *github.ListOptions) ([]string, *github.Response, error), listOptions)
		want      []string
		wantErr   error
	}{
		{
			name: "single page",
			mockSetup: func() (func(context.Context, *github.ListOptions) ([]string, *github.Response, error), listOptions) {
				items := []string{"item1", "item2", "item3"}
				listFn := func(_ context.Context, _ *github.ListOptions) ([]string, *github.Response, error) {
					return items, &github.Response{
						NextPage: 0,
					}, nil
				}
				return listFn, defaultListOptions(100)
			},
			want:    []string{"item1", "item2", "item3"},
			wantErr: nil,
		},
		{
			name: "multiple pages",
			mockSetup: func() (func(context.Context, *github.ListOptions) ([]string, *github.Response, error), listOptions) {
				page1 := []string{"item1", "item2"}
				page2 := []string{"item3", "item4"}
				page3 := []string{"item5"}

				var callCount int
				listFn := func(_ context.Context, opts *github.ListOptions) ([]string, *github.Response, error) {
					callCount++
					switch callCount {
					case 1:
						return page1, &github.Response{
							NextPage: 2,
						}, nil
					case 2:
						assert.Equal(t, 2, opts.Page)
						return page2, &github.Response{
							NextPage: 3,
						}, nil
					case 3:
						assert.Equal(t, 3, opts.Page)
						return page3, &github.Response{
							NextPage: 0,
						}, nil
					default:
						return nil, nil, errors.New("unexpected call")
					}
				}
				return listFn, defaultListOptions(100)
			},
			want:    []string{"item1", "item2", "item3", "item4", "item5"},
			wantErr: nil,
		},
		{
			name: "error on first page",
			mockSetup: func() (func(context.Context, *github.ListOptions) ([]string, *github.Response, error), listOptions) {
				listFn := func(_ context.Context, _ *github.ListOptions) ([]string, *github.Response, error) {
					return nil, &github.Response{}, errors.New("API error")
				}
				return listFn, defaultListOptions(100)
			},
			want:    nil,
			wantErr: errors.New("API error"),
		},
		{
			name: "service unavailable error",
			mockSetup: func() (func(context.Context, *github.ListOptions) ([]string, *github.Response, error), listOptions) {
				listFn := func(_ context.Context, _ *github.ListOptions) ([]string, *github.Response, error) {
					return nil, &github.Response{}, &github.ErrorResponse{
						Response: &http.Response{
							StatusCode: http.StatusServiceUnavailable,
						},
					}
				}
				return listFn, defaultListOptions(100)
			},
			want:    nil,
			wantErr: ErrServiceUnavailable,
		},
		{
			name: "resource not found error",
			mockSetup: func() (func(context.Context, *github.ListOptions) ([]string, *github.Response, error), listOptions) {
				listFn := func(_ context.Context, _ *github.ListOptions) ([]string, *github.Response, error) {
					return nil, &github.Response{}, &github.ErrorResponse{
						Response: &http.Response{
							StatusCode: http.StatusNotFound,
						},
					}
				}
				return listFn, defaultListOptions(100)
			},
			want:    nil,
			wantErr: ErrResourceNotFound,
		},
		{
			name: "too many items error",
			mockSetup: func() (func(context.Context, *github.ListOptions) ([]string, *github.Response, error), listOptions) {
				listFn := func(_ context.Context, _ *github.ListOptions) ([]string, *github.Response, error) {
					// Return more items than the max allowed
					items := make([]string, 10)
					for i := range items {
						items[i] = fmt.Sprintf("item%d", i+1)
					}
					return items, &github.Response{
						NextPage: 2,
					}, nil
				}
				return listFn, listOptions{
					ListOptions: github.ListOptions{
						Page:    1,
						PerPage: 100,
					},
					MaxItems: 5, // Set max items to less than what we'll return
				}
			},
			want:    nil,
			wantErr: ErrTooManyItems,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			listFn, opts := tt.mockSetup()

			got, err := paginatedList(context.Background(), listFn, opts)

			if tt.wantErr != nil {
				assert.Error(t, err)
				if errors.Is(err, tt.wantErr) {
					assert.Equal(t, tt.wantErr, err)
				} else {
					assert.Contains(t, err.Error(), tt.wantErr.Error())
				}
				assert.Nil(t, got)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestDefaultListOptions(t *testing.T) {
	tests := []struct {
		name     string
		maxItems int
		want     listOptions
	}{
		{
			name:     "with zero max items",
			maxItems: 0,
			want: listOptions{
				ListOptions: github.ListOptions{
					Page:    1,
					PerPage: 100,
				},
				MaxItems: 0,
			},
		},
		{
			name:     "with positive max items",
			maxItems: 50,
			want: listOptions{
				ListOptions: github.ListOptions{
					Page:    1,
					PerPage: 100,
				},
				MaxItems: 50,
			},
		},
		{
			name:     "with large max items",
			maxItems: 1000,
			want: listOptions{
				ListOptions: github.ListOptions{
					Page:    1,
					PerPage: 100,
				},
				MaxItems: 1000,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := defaultListOptions(tt.maxItems)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestRealRepositoryContent(t *testing.T) {
	t.Run("IsDirectory", func(t *testing.T) {
		tests := []struct {
			name     string
			repoType string
			want     bool
		}{
			{
				name:     "directory type",
				repoType: "dir",
				want:     true,
			},
			{
				name:     "file type",
				repoType: "file",
				want:     false,
			},
			{
				name:     "empty type",
				repoType: "",
				want:     false,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				repoType := tt.repoType
				content := realRepositoryContent{
					real: &github.RepositoryContent{
						Type: &repoType,
					},
				}
				got := content.IsDirectory()
				assert.Equal(t, tt.want, got)
			})
		}
	})

	t.Run("GetFileContent", func(t *testing.T) {
		fileContent := "test content"
		content := realRepositoryContent{
			real: &github.RepositoryContent{
				Content: &fileContent,
			},
		}
		got, err := content.GetFileContent()
		assert.NoError(t, err)
		assert.Equal(t, fileContent, got)
	})

	t.Run("IsSymlink", func(t *testing.T) {
		tests := []struct {
			name   string
			target *string
			want   bool
		}{
			{
				name:   "is symlink",
				target: github.Ptr("target"),
				want:   true,
			},
			{
				name:   "not symlink",
				target: nil,
				want:   false,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				content := realRepositoryContent{
					real: &github.RepositoryContent{
						Target: tt.target,
					},
				}
				got := content.IsSymlink()
				assert.Equal(t, tt.want, got)
			})
		}
	})

	t.Run("GetPath", func(t *testing.T) {
		path := "path/to/file"
		content := realRepositoryContent{
			real: &github.RepositoryContent{
				Path: &path,
			},
		}
		got := content.GetPath()
		assert.Equal(t, path, got)
	})

	t.Run("GetSHA", func(t *testing.T) {
		sha := "abc123"
		content := realRepositoryContent{
			real: &github.RepositoryContent{
				SHA: &sha,
			},
		}
		got := content.GetSHA()
		assert.Equal(t, sha, got)
	})

	t.Run("GetSize", func(t *testing.T) {
		t.Run("with size field", func(t *testing.T) {
			size := 42
			content := realRepositoryContent{
				real: &github.RepositoryContent{
					Size: &size,
				},
			}
			got := content.GetSize()
			assert.Equal(t, int64(size), got)
		})

		t.Run("with content field", func(t *testing.T) {
			fileContent := "test content"
			content := realRepositoryContent{
				real: &github.RepositoryContent{
					Content: &fileContent,
				},
			}
			got := content.GetSize()
			assert.Equal(t, int64(len(fileContent)), got)
		})

		t.Run("with no size or content", func(t *testing.T) {
			content := realRepositoryContent{
				real: &github.RepositoryContent{},
			}
			got := content.GetSize()
			assert.Equal(t, int64(0), got)
		})
	})
}

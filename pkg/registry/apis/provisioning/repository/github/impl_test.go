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
				assert.Equal(t, tt.wantErr.Error(), err.Error())
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
						w.Write([]byte("not a github error"))
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

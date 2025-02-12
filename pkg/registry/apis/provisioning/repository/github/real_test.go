package github

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/go-github/v66/github"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestIsAuthenticated(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		wantErr    error
	}{
		{
			name:       "success",
			statusCode: http.StatusOK,
			wantErr:    nil,
		},
		{
			name:       "unauthorized",
			statusCode: http.StatusUnauthorized,
			wantErr:    apierrors.NewUnauthorized("token is invalid or expired"),
		},
		{
			name:       "forbidden",
			statusCode: http.StatusForbidden,
			wantErr:    apierrors.NewUnauthorized("token is revoked or has insufficient permissions"),
		},
		{
			name:       "service unavailable",
			statusCode: http.StatusServiceUnavailable,
			wantErr:    ErrServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := newMockClient(t, mockClientOpts{
				statusCode: tt.statusCode,
			})
			impl := NewRealClient(client)

			err := impl.IsAuthenticated(context.Background())
			if tt.wantErr != nil {
				assert.Equal(t, tt.wantErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRepoExists(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		want       bool
		wantErr    bool
	}{
		{
			name:       "repo exists",
			statusCode: http.StatusOK,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "repo does not exist",
			statusCode: http.StatusNotFound,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "error response",
			statusCode: http.StatusInternalServerError,
			want:       false,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := newMockClient(t, mockClientOpts{
				statusCode: tt.statusCode,
			})
			impl := NewRealClient(client)

			got, err := impl.RepoExists(context.Background(), "owner", "repo")
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGetContents(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		mockResponse interface{}
		statusCode   int
		wantFile     bool
		wantDir      bool
		wantErr      error
	}{
		{
			name: "get file contents",
			path: "path/to/file.txt",
			mockResponse: &github.RepositoryContent{
				Type:    github.String("file"),
				Content: github.String("content"),
			},
			statusCode: http.StatusOK,
			wantFile:   true,
			wantDir:    false,
		},
		{
			name: "get directory contents",
			path: "path/to/dir",
			mockResponse: []*github.RepositoryContent{
				{
					Type: github.String("dir"),
					Path: github.String("subdir"),
				},
				{
					Type: github.String("file"),
					Path: github.String("file.txt"),
				},
			},
			statusCode: http.StatusOK,
			wantFile:   false,
			wantDir:    true,
		},
		{
			name:    "path traversal attempt",
			path:    "../secret",
			wantErr: ErrPathTraversalDisallowed,
		},
		{
			name:       "not found",
			path:       "nonexistent",
			statusCode: http.StatusNotFound,
			wantErr:    ErrResourceNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := newMockClient(t, mockClientOpts{
				statusCode:   tt.statusCode,
				mockResponse: tt.mockResponse,
			})
			impl := NewRealClient(client)

			file, dir, err := impl.GetContents(context.Background(), "owner", "repo", tt.path, "main")
			if tt.wantErr != nil {
				assert.Equal(t, tt.wantErr, err)
				return
			}
			require.NoError(t, err)

			if tt.wantFile {
				assert.NotNil(t, file)
				assert.Nil(t, dir)
			}
			if tt.wantDir {
				assert.Nil(t, file)
				assert.NotNil(t, dir)
			}
		})
	}
}

// Mock client implementation
type mockClientOpts struct {
	statusCode   int
	mockResponse interface{}
}

func newMockClient(_ *testing.T, _ mockClientOpts) *github.Client {
	// Create a mock client that returns the specified status code and response
	client := github.NewClient(nil)
	// TODO: Configure mock client with opts.statusCode and opts.mockResponse
	return client
}

package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/auth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestParseRequestOptionsPathValidation(t *testing.T) {
	tests := []struct {
		name        string
		method      string
		path        string
		wantErr     bool
		errContains string
	}{
		{
			name:   "GET json file allowed",
			method: http.MethodGet,
			path:   "dashboard.json",
		},
		{
			name:   "GET yaml file allowed",
			method: http.MethodGet,
			path:   "dashboard.yaml",
		},
		{
			name:   "GET yml file allowed",
			method: http.MethodGet,
			path:   "dashboard.yml",
		},
		{
			name:   "GET markdown file allowed",
			method: http.MethodGet,
			path:   "README.md",
		},
		{
			name:   "GET nested markdown file allowed",
			method: http.MethodGet,
			path:   "folder/subfolder/README.md",
		},
		{
			name:        "GET txt file not allowed",
			method:      http.MethodGet,
			path:        "file.txt",
			wantErr:     true,
			errContains: "unsupported file extension",
		},
		{
			name:   "POST json file allowed",
			method: http.MethodPost,
			path:   "dashboard.json",
		},
		{
			name:        "POST markdown file not allowed",
			method:      http.MethodPost,
			path:        "README.md",
			wantErr:     true,
			errContains: "unsupported file extension",
		},
		{
			name:        "PUT markdown file not allowed",
			method:      http.MethodPut,
			path:        "README.md",
			wantErr:     true,
			errContains: "unsupported file extension",
		},
		{
			name:        "DELETE markdown file not allowed",
			method:      http.MethodDelete,
			path:        "README.md",
			wantErr:     true,
			errContains: "unsupported file extension",
		},
		{
			name:   "GET directory allowed",
			method: http.MethodGet,
			path:   "dashboards/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := repository.NewMockRepository(t)
			mockRepo.On("Config").Return(&provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Title: "test-repo",
				},
			}).Maybe()

			connector := &filesConnector{}
			r := httptest.NewRequest(tt.method, "/test-repo/files/"+tt.path, nil)

			opts, err := connector.parseRequestOptions(r, "test-repo", mockRepo)

			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errContains)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.path, opts.Path)
			}
		})
	}
}

func TestHandleGetRawFile(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		fileContent    string
		readError      error
		wantErr        bool
		errContains    string
		expectedResult string
	}{
		{
			name:           "successful readme read",
			path:           "README.md",
			fileContent:    "# Hello World\n\nThis is a test.",
			expectedResult: "# Hello World\n\nThis is a test.",
		},
		{
			name:           "nested readme read",
			path:           "folder/README.md",
			fileContent:    "# Folder Readme",
			expectedResult: "# Folder Readme",
		},
		{
			name:        "file not found",
			path:        "README.md",
			readError:   repository.ErrFileNotFound,
			wantErr:     true,
			errContains: "not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockReadWriter := repository.NewMockReaderWriter(t)
			mockAccess := auth.NewMockAccessChecker(t)

			// Setup auth mock - always allow
			mockAccess.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()

			// Setup Read mock
			if tt.readError != nil {
				mockReadWriter.EXPECT().Read(mock.Anything, tt.path, "").Return(nil, tt.readError)
			} else {
				mockReadWriter.EXPECT().Read(mock.Anything, tt.path, "").Return(&repository.FileInfo{
					Path: tt.path,
					Data: []byte(tt.fileContent),
					Ref:  "main",
					Hash: "abc123",
				}, nil)
			}

			connector := &filesConnector{
				access: mockAccess,
			}

			opts := resources.DualWriteOptions{
				Path: tt.path,
				Ref:  "",
			}

			result, err := connector.handleGetRawFile(context.Background(), "test-repo", opts, mockReadWriter)

			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errContains)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				require.Equal(t, tt.path, result.Path)

				// Check that content is in the response
				content, ok := result.Resource.File.Object["content"]
				require.True(t, ok, "content field should exist")
				require.Equal(t, tt.expectedResult, content)
			}
		})
	}
}

func TestIsRawFileIntegration(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{
			name:     "README.md is raw",
			path:     "README.md",
			expected: true,
		},
		{
			name:     "nested README.md is raw",
			path:     "folder/subfolder/README.md",
			expected: true,
		},
		{
			name:     "dashboard.json is not raw",
			path:     "dashboard.json",
			expected: false,
		},
		{
			name:     "dashboard.yaml is not raw",
			path:     "dashboard.yaml",
			expected: false,
		},
		{
			name:     "directory is not raw",
			path:     "folder/",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := resources.IsRawFile(tt.path)
			require.Equal(t, tt.expected, result)
		})
	}
}

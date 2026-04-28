package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioningapi "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestCheckQuota(t *testing.T) {
	tests := []struct {
		name       string
		conditions []metav1.Condition
		isCreate   bool
		expectErr  bool
	}{
		{
			name:       "no conditions allows create",
			conditions: nil,
			isCreate:   true,
			expectErr:  false,
		},
		{
			name:       "no conditions allows update",
			conditions: nil,
			isCreate:   false,
			expectErr:  false,
		},
		{
			name: "unlimited quota allows create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaUnlimited,
				},
			},
			isCreate:  true,
			expectErr: false,
		},
		{
			name: "unlimited quota allows update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaUnlimited,
				},
			},
			isCreate:  false,
			expectErr: false,
		},
		{
			name: "within quota allows create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonWithinQuota,
				},
			},
			isCreate:  true,
			expectErr: false,
		},
		{
			name: "within quota allows update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonWithinQuota,
				},
			},
			isCreate:  false,
			expectErr: false,
		},
		{
			name: "quota reached blocks create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaReached,
				},
			},
			isCreate:  true,
			expectErr: true,
		},
		{
			name: "quota reached allows update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaReached,
				},
			},
			isCreate:  false,
			expectErr: false,
		},
		{
			name: "quota exceeded blocks create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioningapi.ReasonQuotaExceeded,
				},
			},
			isCreate:  true,
			expectErr: true,
		},
		{
			name: "quota exceeded blocks update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioningapi.ReasonQuotaExceeded,
				},
			},
			isCreate:  false,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repo.On("Config").Return(&provisioningapi.Repository{
				Status: provisioningapi.RepositoryStatus{
					Conditions: tt.conditions,
				},
			})

			err := checkQuota(repo, tt.isCreate)

			if tt.expectErr {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "error should be Forbidden, got: %v", err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestHandleMethodRequest_FolderMetadataGuard(t *testing.T) {
	tests := []struct {
		name            string
		method          string
		path            string
		flagEnabled     bool
		expectForbidden bool
	}{
		{
			name:            "POST _folder.json flag on",
			method:          http.MethodPost,
			path:            "folder/_folder.json",
			flagEnabled:     true,
			expectForbidden: true,
		},
		{
			name:            "PUT _folder.json flag on",
			method:          http.MethodPut,
			path:            "folder/_folder.json",
			flagEnabled:     true,
			expectForbidden: true,
		},
		{
			name:            "DELETE _folder.json flag on",
			method:          http.MethodDelete,
			path:            "folder/_folder.json",
			flagEnabled:     true,
			expectForbidden: true,
		},
		{
			name:            "GET _folder.json flag on",
			method:          http.MethodGet,
			path:            "folder/_folder.json",
			flagEnabled:     true,
			expectForbidden: false,
		},
		{
			name:            "POST _folder.json flag off",
			method:          http.MethodPost,
			path:            "folder/_folder.json",
			flagEnabled:     false,
			expectForbidden: false,
		},
		{
			name:            "POST regular file flag on",
			method:          http.MethodPost,
			path:            "folder/dashboard.json",
			flagEnabled:     true,
			expectForbidden: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			connector := &filesConnector{folderMetadataEnabled: tc.flagEnabled}
			req := httptest.NewRequest(tc.method, "/", nil)
			opts := resources.DualWriteOptions{Path: tc.path}

			if tc.expectForbidden {
				_, err := connector.handleMethodRequest(context.Background(), req, "test-repo", opts, false, nil, nil)
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err))
			} else {
				// Guard does not fire; code proceeds past it and panics on nil dualReadWriter.
				// This is intentional: we only test the guard logic here, not the downstream handlers.
				require.Panics(t, func() {
					//nolint:errcheck
					_, _ = connector.handleMethodRequest(context.Background(), req, "test-repo", opts, false, nil, nil)
				}, "guard must not intercept; code should proceed past the guard")
			}
		})
	}
}

func TestHandlePut_DirectoryRouting(t *testing.T) {
	tests := []struct {
		name                   string
		path                   string
		isDir                  bool
		folderMetadataEnabled  bool
		expectMethodNotAllowed bool
	}{
		{
			name:                  "directory with flag on routes to folder metadata update",
			path:                  "myfolder/",
			isDir:                 true,
			folderMetadataEnabled: true,
		},
		{
			name:                   "directory with flag off returns method not supported",
			path:                   "myfolder/",
			isDir:                  true,
			folderMetadataEnabled:  false,
			expectMethodNotAllowed: true,
		},
		{
			name:                  "file path with flag on routes to normal update",
			path:                  "myfolder/dashboard.json",
			isDir:                 false,
			folderMetadataEnabled: true,
		},
		{
			name:                  "file path with flag off routes to normal update",
			path:                  "myfolder/dashboard.json",
			isDir:                 false,
			folderMetadataEnabled: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			connector := &filesConnector{folderMetadataEnabled: tc.folderMetadataEnabled}
			body := strings.NewReader(`{"spec":{"title":"Test"}}`)
			req := httptest.NewRequest(http.MethodPut, "/", body)
			opts := resources.DualWriteOptions{Path: tc.path}

			if tc.expectMethodNotAllowed {
				_, err := connector.handlePut(context.Background(), req, opts, tc.isDir, nil)
				require.Error(t, err)
				assert.True(t, apierrors.IsMethodNotSupported(err), "expected MethodNotSupported, got: %v", err)
				return
			}

			// Non-error cases proceed into the handler which dereferences the nil
			// dualReadWriter. The panic confirms the routing decision was correct.
			require.Panics(t, func() {
				//nolint:errcheck
				_, _ = connector.handlePut(context.Background(), req, opts, tc.isDir, nil)
			}, "should proceed past routing and panic on nil dualReadWriter")
		})
	}
}

func TestHandleMethodRequest_PutDirectoryRouting(t *testing.T) {
	t.Run("PUT to directory with flag on passes guard and reaches handlePut", func(t *testing.T) {
		connector := &filesConnector{folderMetadataEnabled: true}
		body := strings.NewReader(`{"spec":{"title":"Test"}}`)
		req := httptest.NewRequest(http.MethodPut, "/", body)
		opts := resources.DualWriteOptions{Path: "myfolder/"}

		require.Panics(t, func() {
			//nolint:errcheck
			_, _ = connector.handleMethodRequest(context.Background(), req, "test-repo", opts, true, nil, nil)
		})
	})

	t.Run("PUT to directory with flag off returns method not supported", func(t *testing.T) {
		connector := &filesConnector{folderMetadataEnabled: false}
		body := strings.NewReader(`{"spec":{"title":"Test"}}`)
		req := httptest.NewRequest(http.MethodPut, "/", body)
		opts := resources.DualWriteOptions{Path: "myfolder/"}

		_, err := connector.handleMethodRequest(context.Background(), req, "test-repo", opts, true, nil, nil)
		require.Error(t, err)
		assert.True(t, apierrors.IsMethodNotSupported(err))
	})

	t.Run("PUT to folder path without flag is method not supported", func(t *testing.T) {
		connector := &filesConnector{folderMetadataEnabled: false}
		body := strings.NewReader(`{"spec":{"title":"Test"}}`)
		req := httptest.NewRequest(http.MethodPut, "/", body)
		opts := resources.DualWriteOptions{Path: "nested/folder/"}

		_, err := connector.handlePut(context.Background(), req, opts, true, nil)
		require.Error(t, err)
		assert.True(t, apierrors.IsMethodNotSupported(err), "expected MethodNotSupported, got: %v", err)
	})
}

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
			mockRepo.On("Config").Return(&provisioningapi.Repository{
				Spec: provisioningapi.RepositorySpec{
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
			mockAccess.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()

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

			connector := &filesConnector{access: mockAccess}

			opts := resources.DualWriteOptions{Path: tt.path}

			result, err := connector.handleGetRawFile(context.Background(), "test-repo", opts, mockReadWriter)

			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errContains)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				require.Equal(t, tt.path, result.Path)

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
			require.Equal(t, tt.expected, resources.IsRawFile(tt.path))
		})
	}
}

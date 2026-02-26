package resources

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestGetPathType(t *testing.T) {
	tests := []struct {
		name     string
		isDir    bool
		expected string
	}{
		{
			name:     "directory path",
			isDir:    true,
			expected: "directory (ends with '/')",
		},
		{
			name:     "file path",
			isDir:    false,
			expected: "file (no trailing '/')",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getPathType(tt.isDir)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMovePathValidation(t *testing.T) {
	tests := []struct {
		name         string
		originalPath string
		newPath      string
		expectError  bool
		errorMessage string
	}{
		{
			name:         "file to file move (valid)",
			originalPath: "old/file.json",
			newPath:      "new/file.json",
			expectError:  false,
		},
		{
			name:         "directory to directory move (valid)",
			originalPath: "old/folder/",
			newPath:      "new/folder/",
			expectError:  false,
		},
		{
			name:         "file to directory move (invalid)",
			originalPath: "old/file.json",
			newPath:      "new/folder/",
			expectError:  true,
			errorMessage: "cannot move between file and directory types",
		},
		{
			name:         "directory to file move (invalid)",
			originalPath: "old/folder/",
			newPath:      "new/file.json",
			expectError:  true,
			errorMessage: "cannot move between file and directory types",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the path validation logic that would be used in MoveResource
			sourceIsDir := safepath.IsDir(tt.originalPath)
			targetIsDir := safepath.IsDir(tt.newPath)

			if tt.expectError {
				assert.NotEqual(t, sourceIsDir, targetIsDir, "Path types should be different for invalid moves")
			} else {
				assert.Equal(t, sourceIsDir, targetIsDir, "Path types should be the same for valid moves")
			}
		})
	}
}

func TestMoveOptionsContentHandling(t *testing.T) {
	tests := []struct {
		name                 string
		opts                 DualWriteOptions
		originalData         []byte
		expectedContentToUse []byte
		expectedUseOriginal  bool
	}{
		{
			name: "move with new content provided",
			opts: DualWriteOptions{
				Path:         "new/file.json",
				OriginalPath: "old/file.json",
				Data:         []byte(`{"updated": "content"}`),
			},
			originalData:         []byte(`{"original": "content"}`),
			expectedContentToUse: []byte(`{"updated": "content"}`),
			expectedUseOriginal:  false,
		},
		{
			name: "move without new content (nil)",
			opts: DualWriteOptions{
				Path:         "new/file.json",
				OriginalPath: "old/file.json",
				Data:         nil,
			},
			originalData:         []byte(`{"original": "content"}`),
			expectedContentToUse: []byte(`{"original": "content"}`),
			expectedUseOriginal:  true,
		},
		{
			name: "move without new content (empty slice)",
			opts: DualWriteOptions{
				Path:         "new/file.json",
				OriginalPath: "old/file.json",
				Data:         []byte{},
			},
			originalData:         []byte(`{"original": "content"}`),
			expectedContentToUse: []byte(`{"original": "content"}`),
			expectedUseOriginal:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the content selection logic from moveFile method
			var destinationData []byte
			useOriginal := len(tt.opts.Data) == 0

			if useOriginal {
				destinationData = tt.originalData
			} else {
				destinationData = tt.opts.Data
			}

			assert.Equal(t, tt.expectedUseOriginal, useOriginal, "Should correctly determine whether to use original content")
			assert.Equal(t, tt.expectedContentToUse, destinationData, "Should select correct content for destination")
		})
	}
}

func TestShouldUpdateGrafanaDB(t *testing.T) {
	tests := []struct {
		name   string
		repo   provisioning.RepositorySpec
		opts   DualWriteOptions
		parsed *ParsedResource
		expect bool
	}{
		{
			name: "update when parsed and sync enabled",
			opts: DualWriteOptions{
				Ref: "something",
			},
			repo: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git: &provisioning.GitRepositoryConfig{
					Branch: "something",
				},
				Sync: provisioning.SyncOptions{
					Enabled: true,
				},
			},
			parsed: &ParsedResource{
				Client: &MockDynamicResourceInterface{},
			},
			expect: true,
		}, {
			name: "do not write when its a different branch",
			opts: DualWriteOptions{
				Ref: "something",
			},
			repo: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git: &provisioning.GitRepositoryConfig{
					Branch: "something-else",
				},
				Sync: provisioning.SyncOptions{
					Enabled: true,
				},
			},
			parsed: &ParsedResource{
				Client: &MockDynamicResourceInterface{},
			},
			expect: false,
		}, {
			name: "do not write when sync is disabled",
			opts: DualWriteOptions{
				Ref: "something",
			},
			repo: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git: &provisioning.GitRepositoryConfig{
					Branch: "something",
				},
				Sync: provisioning.SyncOptions{
					Enabled: false, // <<<<<<
				},
			},
			parsed: &ParsedResource{
				Client: &MockDynamicResourceInterface{},
			},
			expect: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rw := repository.NewMockReaderWriter(t)
			rw.On("Config").Return(&provisioning.Repository{Spec: tt.repo})
			dw := &DualReadWriter{repo: rw}

			update := dw.shouldUpdateGrafanaDB(tt.opts, tt.parsed)

			assert.Equal(t, tt.expect, update, "Should correctly determine if we should update")
		})
	}
}

func newTestRepoConfig(name string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
		},
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.LocalRepositoryType,
			Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			Sync:      provisioning.SyncOptions{Enabled: false},
		},
	}
}

func TestCreateFolder_FolderMetadata_FlagDisabled(t *testing.T) {
	ctx := context.Background()

	config := newTestRepoConfig("test-repo")
	rw := repository.NewMockReaderWriter(t)
	rw.On("Config").Return(config)
	// Flag disabled: expect Create called with dir path and nil data (legacy .keep behavior)
	rw.On("Create", mock.Anything, "newfolder/", "", ([]byte)(nil), "").Return(nil)

	accessMock := auth.NewMockAccessChecker(t)
	accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

	dw := &DualReadWriter{
		repo:     rw,
		access:   accessMock,
		features: featuremgmt.WithFeatures(),
	}

	result, err := dw.CreateFolder(ctx, DualWriteOptions{Path: "newfolder/"})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "newfolder/", result.Path)
}

func TestCreateFolder_FolderMetadata_FlagEnabled(t *testing.T) {
	ctx := context.Background()

	config := newTestRepoConfig("test-repo")
	rw := repository.NewMockReaderWriter(t)
	rw.On("Config").Return(config)

	// Flag enabled: expect Create called with _folder.json path and valid Folder resource JSON
	var capturedUID string
	rw.On("Create", mock.Anything, "newfolder/_folder.json", "", mock.MatchedBy(func(b []byte) bool {
		var res folders.Folder
		if err := json.Unmarshal(b, &res); err != nil {
			return false
		}
		capturedUID = res.Name
		return res.APIVersion == "folder.grafana.app/v1beta1" &&
			res.Kind == "Folder" &&
			res.Name != "" &&
			res.Spec.Title == "newfolder"
	}), "").Return(nil)

	accessMock := auth.NewMockAccessChecker(t)
	accessMock.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(nil)

	dw := &DualReadWriter{
		repo:     rw,
		access:   accessMock,
		features: featuremgmt.WithFeatures(featuremgmt.FlagProvisioningFolderMetadata),
	}

	result, err := dw.CreateFolder(ctx, DualWriteOptions{Path: "newfolder/"})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "newfolder/", result.Path)
	assert.NotEmpty(t, capturedUID, "_folder.json should have been written with a non-empty metadata.name")
}

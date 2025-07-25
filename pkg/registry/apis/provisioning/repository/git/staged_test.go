package git

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/nanogit"
	"github.com/grafana/nanogit/mocks"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/stretchr/testify/require"
)

func TestNewStagedGitRepository(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*mocks.FakeClient)
		opts        repository.StageOptions
		wantError   error
		expectedRef string
	}{
		{
			name: "succeeds with default options",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			expectedRef: "refs/heads/main",
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			wantError: nil,
		},
		{
			name: "succeeds with custom ref option",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/custom",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			expectedRef: "refs/heads/custom",
			opts: repository.StageOptions{
				Ref:          "custom",
				PushOnWrites: false,
			},
			wantError: nil,
		},
		{
			name: "succeeds with BeforeFn",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			wantError:   nil,
			expectedRef: "refs/heads/main",
		},
		{
			name: "succeeds with timeout",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			opts: repository.StageOptions{
				Mode:    repository.StageModeCommitOnEach,
				Timeout: time.Second * 5,
			},
			expectedRef: "refs/heads/main",
			wantError:   nil,
		},
		{
			name: "succeeds with CommitOnlyOnce option",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			opts: repository.StageOptions{
				Mode:                  repository.StageModeCommitOnlyOnce,
				CommitOnlyOnceMessage: "Custom commit message",
			},
			expectedRef: "refs/heads/main",
			wantError:   nil,
		},
		{
			name: "succeeds with CommitAndPushOnEach option",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitAndPushOnEach,
			},
			expectedRef: "refs/heads/main",
			wantError:   nil,
		},
		{
			name: "fails with GetRef error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("ref not found"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			wantError: errors.New("ref not found"),
		},
		{
			name: "fails with NewStagedWriter error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockClient.NewStagedWriterReturns(nil, errors.New("failed to create writer"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			wantError:   errors.New("build staged writer: failed to create writer"),
			expectedRef: "refs/heads/main",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					URL:    "https://git.example.com/repo.git",
					Token:  "token123",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: "test_type",
					},
				},
			}

			stagedRepo, err := NewStagedGitRepository(context.Background(), gitRepo, tt.opts)
			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
				require.NotNil(t, stagedRepo)

				// Compare opts fields individually since function pointers can't be compared directly
				actualOpts := stagedRepo.(*stagedGitRepository).opts
				require.Equal(t, tt.opts.Mode, actualOpts.Mode)
				require.Equal(t, tt.opts.Timeout, actualOpts.Timeout)
				require.Equal(t, tt.opts.CommitOnlyOnceMessage, actualOpts.CommitOnlyOnceMessage)

				// Verify the expected ref
				_, ref := mockClient.GetRefArgsForCall(0)
				require.Equal(t, tt.expectedRef, ref)
			}
		})
	}
}

func TestStagedGitRepository_Read(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		path      string
		ref       string
		wantError error
	}{
		{
			name: "succeeds with empty ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.Hash{4, 5, 6},
				}, nil)
				mockClient.GetBlobByPathReturns(&nanogit.Blob{
					Content: []byte("file content"),
					Hash:    hash.Hash{7, 8, 9},
				}, nil)
			},
			path:      "test.yaml",
			ref:       "",
			wantError: nil,
		},
		{
			name: "succeeds with matching ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.Hash{4, 5, 6},
				}, nil)
				mockClient.GetBlobByPathReturns(&nanogit.Blob{
					Content: []byte("file content"),
					Hash:    hash.Hash{7, 8, 9},
				}, nil)
			},
			path:      "test.yaml",
			ref:       "main",
			wantError: nil,
		},
		{
			name: "succeeds with ref matching stage options",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.Hash{4, 5, 6},
				}, nil)
				mockClient.GetBlobByPathReturns(&nanogit.Blob{
					Content: []byte("file content"),
					Hash:    hash.Hash{7, 8, 9},
				}, nil)
			},
			path:      "test.yaml",
			ref:       "feature",
			wantError: nil,
		},
		{
			name: "fails with unsupported ref",
			setupMock: func(_ *mocks.FakeClient) {
				// No setup needed as error occurs before client calls
			},
			path:      "test.yaml",
			ref:       "feature-branch",
			wantError: errors.New("ref is not supported for staged repository"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			// Use stage options with ref "feature" for the specific test case
			opts := repository.StageOptions{}
			if tt.ref == "feature" {
				opts.Ref = "feature"
			}

			stagedRepo := createTestStagedRepositoryWithWriter(&mocks.FakeStagedWriter{}, opts, mockClient)
			fileInfo, err := stagedRepo.Read(context.Background(), tt.path, tt.ref)
			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
				require.NotNil(t, fileInfo)
				require.Equal(t, tt.path, fileInfo.Path)
			}
		})
	}
}

func TestStagedGitRepository_ReadTree(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		ref       string
		wantError error
	}{
		{
			name: "succeeds with empty ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockClient.GetFlatTreeReturns(&nanogit.FlatTree{
					Entries: []nanogit.FlatTreeEntry{
						{
							Path: "configs/test.yaml",
							Hash: hash.Hash{4, 5, 6},
						},
					},
				}, nil)
			},
			ref:       "",
			wantError: nil,
		},
		{
			name: "fails with unsupported ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No setup needed as error occurs before client calls
			},
			ref:       "feature-branch",
			wantError: errors.New("ref is not supported for staged repository"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			stagedRepo := createTestStagedRepository(mockClient)

			entries, err := stagedRepo.ReadTree(context.Background(), tt.ref)

			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
				require.NotNil(t, entries)
			}
		})
	}
}

func TestStagedGitRepository_Create(t *testing.T) {
	tests := []struct {
		name       string
		setupMock  func(*mocks.FakeStagedWriter)
		opts       repository.StageOptions
		path       string
		ref        string
		data       []byte
		message    string
		wantError  error
		expectPush bool
	}{
		{
			name: "succeeds with empty ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CreateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:       "test.yaml",
			ref:        "",
			data:       []byte("content"),
			message:    "Create test file",
			wantError:  nil,
			expectPush: false,
		},
		{
			name: "succeeds with matching ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CreateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitAndPushOnEach,
			},
			path:       "test.yaml",
			ref:        "main",
			data:       []byte("content"),
			message:    "Create test file",
			wantError:  nil,
			expectPush: true,
		},
		{
			name: "fails with unsupported ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				// No setup needed as error occurs before writer calls
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "feature-branch",
			data:      []byte("content"),
			message:   "Create test file",
			wantError: errors.New("ref is not supported for staged repository"),
		},
		{
			name: "fails with create blob error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CreateBlobReturns(hash.Hash{}, errors.New("create blob failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Create test file",
			wantError: errors.New("create blob: create blob failed"),
		},
		{
			name: "fails with commit error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CreateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Create test file",
			wantError: errors.New("commit changes: commit failed"),
		},
		{
			name: "fails with push error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CreateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(errors.New("push failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitAndPushOnEach,
			},
			path:       "test.yaml",
			ref:        "",
			data:       []byte("content"),
			message:    "Create test file",
			wantError:  errors.New("push failed"),
			expectPush: true, // Push is still called even though it fails
		},
		{
			name: "succeeds with CommitOnlyOnce - no immediate commit",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CreateBlobReturns(hash.Hash{1, 2, 3}, nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnlyOnce,
			},
			path:       "test.yaml",
			ref:        "",
			data:       []byte("content"),
			message:    "Create test file",
			wantError:  nil,
			expectPush: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Create(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if tt.wantError == nil {
				require.Equal(t, 0, mockWriter.PushCallCount())
			}

			// Verify commit behavior based on StageMode
			switch tt.opts.Mode {
			case repository.StageModeCommitOnlyOnce:
				require.Equal(t, 0, mockWriter.CommitCallCount(), "No commits should be made when StageModeCommitOnlyOnce is used")
			case repository.StageModeCommitOnEach, repository.StageModeCommitAndPushOnEach:
				if tt.wantError == nil || strings.Contains(tt.wantError.Error(), "push failed") {
					require.Equal(t, 1, mockWriter.CommitCallCount(), "One commit should be made when using commit modes (even if push fails)")
				} else if tt.wantError != nil && strings.Contains(tt.wantError.Error(), "commit") {
					// Commit failed, so it should have been attempted but failed
					require.Equal(t, 1, mockWriter.CommitCallCount(), "Commit should be attempted even if it fails")
				} else if tt.wantError != nil {
					require.Equal(t, 0, mockWriter.CommitCallCount(), "No commits should be made when error occurs before commit")
				}
			default:
				// Default behavior (backward compatibility)
				if tt.wantError == nil || strings.Contains(tt.wantError.Error(), "push failed") {
					require.Equal(t, 1, mockWriter.CommitCallCount(), "One commit should be made with default mode (even if push fails)")
				} else if tt.wantError != nil {
					require.Equal(t, 0, mockWriter.CommitCallCount(), "No commits should be made when error occurs before commit")
				}
			}
		})
	}
}

func TestStagedGitRepository_Write(t *testing.T) {
	tests := []struct {
		name       string
		setupMock  func(*mocks.FakeStagedWriter)
		opts       repository.StageOptions
		path       string
		ref        string
		data       []byte
		message    string
		fileExists bool
		wantError  error
		expectPush bool
	}{
		{
			name: "succeeds with empty ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.BlobExistsReturns(false, nil)
				mockWriter.CreateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:       "test.yaml",
			ref:        "",
			data:       []byte("content"),
			message:    "Write test file",
			fileExists: false,
			wantError:  nil,
			expectPush: false,
		},
		{
			name: "succeeds with matching ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.BlobExistsReturns(true, nil)
				mockWriter.UpdateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitAndPushOnEach,
			},
			path:       "test.yaml",
			ref:        "main",
			data:       []byte("updated content"),
			message:    "Update test file",
			fileExists: true,
			wantError:  nil,
			expectPush: true,
		},
		{
			name: "fails with unsupported ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				// No setup needed as error occurs before writer calls
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "feature-branch",
			data:      []byte("content"),
			message:   "Write test file",
			wantError: errors.New("ref is not supported for staged repository"),
		},
		{
			name: "fails with blob exists check error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.BlobExistsReturns(false, errors.New("blob exists check failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Write test file",
			wantError: errors.New("check if file exists: blob exists check failed"),
		},
		{
			name: "fails with create error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.BlobExistsReturns(false, nil)
				mockWriter.CreateBlobReturns(hash.Hash{}, errors.New("create failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Write test file",
			wantError: errors.New("create blob: create failed"),
		},
		{
			name: "fails with update error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.BlobExistsReturns(true, nil)
				mockWriter.UpdateBlobReturns(hash.Hash{}, errors.New("update failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Write test file",
			wantError: errors.New("update blob: update failed"),
		},
		{
			name: "fails with commit error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.BlobExistsReturns(false, nil)
				mockWriter.CreateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Write test file",
			wantError: errors.New("commit changes: commit failed"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Write(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if tt.wantError == nil {
				require.Equal(t, 0, mockWriter.PushCallCount())
			}
		})
	}
}

func TestStagedGitRepository_Update(t *testing.T) {
	tests := []struct {
		name       string
		setupMock  func(*mocks.FakeStagedWriter)
		opts       repository.StageOptions
		path       string
		ref        string
		data       []byte
		message    string
		wantError  error
		expectPush bool
	}{
		{
			name: "succeeds with empty ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.UpdateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:       "test.yaml",
			ref:        "",
			data:       []byte("updated content"),
			message:    "Update test file",
			wantError:  nil,
			expectPush: false,
		},
		{
			name: "succeeds with matching ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.UpdateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitAndPushOnEach,
			},
			path:       "test.yaml",
			ref:        "main",
			data:       []byte("updated content"),
			message:    "Update test file",
			wantError:  nil,
			expectPush: true,
		},
		{
			name: "fails with unsupported ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				// No setup needed as error occurs before writer calls
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "feature-branch",
			data:      []byte("content"),
			message:   "Update test file",
			wantError: errors.New("ref is not supported for staged repository"),
		},
		{
			name: "fails with directory update",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				// No setup needed as error occurs before writer calls
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "directory/",
			ref:       "",
			data:      []byte("content"),
			message:   "Update directory",
			wantError: errors.New("cannot update a directory in a staged repository"),
		},
		{
			name: "fails with update blob error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.UpdateBlobReturns(hash.Hash{}, errors.New("update blob failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Update test file",
			wantError: errors.New("update blob: update blob failed"),
		},
		{
			name: "fails with commit error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.UpdateBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			data:      []byte("content"),
			message:   "Update test file",
			wantError: errors.New("commit changes: commit failed"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Update(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if tt.wantError == nil {
				require.Equal(t, 0, mockWriter.PushCallCount())
			}
		})
	}
}

func TestStagedGitRepository_Delete(t *testing.T) {
	tests := []struct {
		name       string
		setupMock  func(*mocks.FakeStagedWriter)
		opts       repository.StageOptions
		path       string
		ref        string
		message    string
		wantError  error
		expectPush bool
	}{
		{
			name: "succeeds with empty ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.DeleteBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:       "test.yaml",
			ref:        "",
			message:    "Delete test file",
			wantError:  nil,
			expectPush: false,
		},
		{
			name: "succeeds with matching ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.DeleteTreeReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitAndPushOnEach,
			},
			path:       "testdir/",
			ref:        "main",
			message:    "Delete test directory",
			wantError:  nil,
			expectPush: true,
		},
		{
			name: "fails with unsupported ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				// No setup needed as error occurs before writer calls
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "feature-branch",
			message:   "Delete test file",
			wantError: errors.New("ref is not supported for staged repository"),
		},
		{
			name: "fails with delete blob error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.DeleteBlobReturns(hash.Hash{}, errors.New("delete blob failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			message:   "Delete test file",
			wantError: errors.New("delete blob: delete blob failed"),
		},
		{
			name: "fails with commit error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.DeleteBlobReturns(hash.Hash{1, 2, 3}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnEach,
			},
			path:      "test.yaml",
			ref:       "",
			message:   "Delete test file",
			wantError: errors.New("commit changes: commit failed"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Delete(context.Background(), tt.path, tt.ref, tt.message)

			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if tt.wantError == nil {
				require.Equal(t, 0, mockWriter.PushCallCount())
			}
		})
	}
}

func TestStagedGitRepository_Push(t *testing.T) {
	tests := []struct {
		name              string
		opts              repository.StageOptions
		setupMock         func(*mocks.FakeStagedWriter)
		wantError         error
		expectPushCalls   int
		expectCommitCalls int
	}{
		{
			name: "succeeds with normal push",
			opts: repository.StageOptions{},
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			wantError:         nil,
			expectPushCalls:   1,
			expectCommitCalls: 0,
		},
		{
			name: "succeeds with timeout",
			opts: repository.StageOptions{
				Timeout: time.Second * 5,
			},
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			wantError:         nil,
			expectPushCalls:   1,
			expectCommitCalls: 0,
		},
		{
			name: "succeeds with CommitOnlyOnce and default message",
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnlyOnce,
			},
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			wantError:         nil,
			expectPushCalls:   1,
			expectCommitCalls: 1,
		},
		{
			name: "succeeds with CommitOnlyOnce and custom message",
			opts: repository.StageOptions{
				Mode:                  repository.StageModeCommitOnlyOnce,
				CommitOnlyOnceMessage: "Custom commit message",
			},
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			wantError:         nil,
			expectPushCalls:   1,
			expectCommitCalls: 1,
		},
		{
			name: "fails with commit error when CommitOnlyOnce",
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnlyOnce,
			},
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
			wantError:         errors.New("commit changes: commit failed"),
			expectPushCalls:   0,
			expectCommitCalls: 1,
		},
		{
			name: "fails with push error",
			opts: repository.StageOptions{},
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(errors.New("push failed"))
			},
			wantError:         errors.New("push failed"),
			expectPushCalls:   1,
			expectCommitCalls: 0,
		},
		{
			name: "fails with push error after successful commit",
			opts: repository.StageOptions{
				Mode: repository.StageModeCommitOnlyOnce,
			},
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(errors.New("push failed"))
			},
			wantError:         errors.New("push failed"),
			expectPushCalls:   1,
			expectCommitCalls: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Push(context.Background())

			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.expectPushCalls, mockWriter.PushCallCount())
			require.Equal(t, tt.expectCommitCalls, mockWriter.CommitCallCount())

			// Verify commit message when CommitOnlyOnce is used
			if tt.opts.Mode == repository.StageModeCommitOnlyOnce && tt.expectCommitCalls > 0 && tt.wantError == nil {
				_, actualMessage, _, _ := mockWriter.CommitArgsForCall(0)
				expectedMessage := tt.opts.CommitOnlyOnceMessage
				if expectedMessage == "" {
					expectedMessage = "Staged changes"
				}
				require.Equal(t, expectedMessage, actualMessage)
			}
		})
	}
}

func TestStagedGitRepository_Remove(t *testing.T) {
	t.Run("succeeds with remove", func(t *testing.T) {
		mockWriter := &mocks.FakeStagedWriter{}
		stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, repository.StageOptions{})

		err := stagedRepo.Remove(context.Background())
		require.NoError(t, err)
		require.Equal(t, 1, mockWriter.CleanupCallCount())
	})
}

func TestStagedGitRepository_isRefSupported(t *testing.T) {
	tests := []struct {
		name      string
		stageOpts repository.StageOptions
		gitBranch string
		ref       string
		expected  bool
	}{
		{
			name:      "empty ref is supported",
			stageOpts: repository.StageOptions{},
			gitBranch: "main",
			ref:       "",
			expected:  true,
		},
		{
			name:      "ref matches git config branch",
			stageOpts: repository.StageOptions{},
			gitBranch: "main",
			ref:       "main",
			expected:  true,
		},
		{
			name:      "ref matches stage options ref",
			stageOpts: repository.StageOptions{Ref: "feature"},
			gitBranch: "main",
			ref:       "feature",
			expected:  true,
		},
		{
			name:      "ref matches stage options ref when empty defaults to git branch",
			stageOpts: repository.StageOptions{Ref: ""},
			gitBranch: "main",
			ref:       "main",
			expected:  true,
		},
		{
			name:      "unsupported ref",
			stageOpts: repository.StageOptions{Ref: "feature"},
			gitBranch: "main",
			ref:       "other-branch",
			expected:  false,
		},
		{
			name:      "unsupported ref with empty stage options",
			stageOpts: repository.StageOptions{},
			gitBranch: "main",
			ref:       "feature",
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stagedRepo := &stagedGitRepository{
				gitRepository: &gitRepository{
					gitConfig: RepositoryConfig{
						Branch: tt.gitBranch,
					},
				},
				opts: tt.stageOpts,
			}

			result := stagedRepo.isRefSupported(tt.ref)
			require.Equal(t, tt.expected, result)
		})
	}
}

// Helper functions for creating test instances

func createTestStagedRepository(mockClient *mocks.FakeClient) *stagedGitRepository {
	mockWriter := &mocks.FakeStagedWriter{}
	return createTestStagedRepositoryWithWriter(mockWriter, repository.StageOptions{}, mockClient)
}

func createTestStagedRepositoryWithWriter(mockWriter *mocks.FakeStagedWriter, opts repository.StageOptions, mockClient ...*mocks.FakeClient) *stagedGitRepository {
	var client nanogit.Client
	if len(mockClient) > 0 {
		client = mockClient[0]
	} else {
		// Create a default mock client for tests that don't need specific behavior
		defaultClient := &mocks.FakeClient{}
		client = defaultClient
	}

	gitRepo := &gitRepository{
		client: client,
		gitConfig: RepositoryConfig{
			Branch: "main",
			URL:    "https://git.example.com/repo.git",
			Token:  "token123",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: "test_type",
			},
		},
	}

	return &stagedGitRepository{
		gitRepository: gitRepo,
		opts:          opts,
		writer:        mockWriter,
	}
}

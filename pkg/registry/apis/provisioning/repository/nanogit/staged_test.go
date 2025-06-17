package nanogit

import (
	"context"
	"errors"
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
		name      string
		setupMock func(*mocks.FakeClient)
		opts      repository.CloneOptions
		wantError error
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
			opts: repository.CloneOptions{
				CreateIfNotExists: false,
				PushOnWrites:      false,
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
			opts: repository.CloneOptions{
				CreateIfNotExists: false,
				PushOnWrites:      false,
				BeforeFn: func() error {
					return nil
				},
			},
			wantError: nil,
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
			opts: repository.CloneOptions{
				CreateIfNotExists: false,
				PushOnWrites:      false,
				Timeout:           time.Second * 5,
			},
			wantError: nil,
		},
		{
			name: "fails with BeforeFn error",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No setup needed as BeforeFn fails first
			},
			opts: repository.CloneOptions{
				BeforeFn: func() error {
					return errors.New("before function failed")
				},
			},
			wantError: errors.New("before function failed"),
		},
		{
			name: "fails with GetRef error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("ref not found"))
			},
			opts: repository.CloneOptions{
				CreateIfNotExists: false,
				PushOnWrites:      false,
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
			opts: repository.CloneOptions{
				CreateIfNotExists: false,
				PushOnWrites:      false,
			},
			wantError: errors.New("build staged writer: failed to create writer"),
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
				require.Equal(t, tt.opts.CreateIfNotExists, actualOpts.CreateIfNotExists)
				require.Equal(t, tt.opts.PushOnWrites, actualOpts.PushOnWrites)
				require.Equal(t, tt.opts.MaxSize, actualOpts.MaxSize)
				require.Equal(t, tt.opts.Timeout, actualOpts.Timeout)
				require.Equal(t, tt.opts.Progress, actualOpts.Progress)
				// BeforeFn is a function pointer, so we just check if both are nil or both are not nil
				require.Equal(t, tt.opts.BeforeFn == nil, actualOpts.BeforeFn == nil)
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

			stagedRepo := createTestStagedRepository(mockClient)
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
		opts       repository.CloneOptions
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: true,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: true,
			},
			path:       "test.yaml",
			ref:        "",
			data:       []byte("content"),
			message:    "Create test file",
			wantError:  errors.New("push failed"),
			expectPush: true, // Push is still called even though it fails
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
		})
	}
}

func TestStagedGitRepository_Write(t *testing.T) {
	tests := []struct {
		name       string
		setupMock  func(*mocks.FakeStagedWriter)
		opts       repository.CloneOptions
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: true,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
		opts       repository.CloneOptions
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: true,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
		opts       repository.CloneOptions
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: true,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
			opts: repository.CloneOptions{
				PushOnWrites: false,
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
		name        string
		setupMock   func(*mocks.FakeStagedWriter)
		opts        repository.PushOptions
		wantError   error
		expectCalls int
	}{
		{
			name: "succeeds with empty ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			opts:        repository.PushOptions{},
			wantError:   nil,
			expectCalls: 1,
		},
		{
			name: "succeeds with matching ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			opts: repository.PushOptions{
				BeforeFn: func() error {
					return nil
				},
			},
			wantError:   nil,
			expectCalls: 1,
		},
		{
			name: "succeeds with timeout",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			opts: repository.PushOptions{
				Timeout: time.Second * 5,
			},
			wantError:   nil,
			expectCalls: 1,
		},
		{
			name: "fails with before fn error",
			setupMock: func(_ *mocks.FakeStagedWriter) {
				// No setup needed as BeforeFn fails first
			},
			opts: repository.PushOptions{
				BeforeFn: func() error {
					return errors.New("before function failed")
				},
			},
			wantError:   errors.New("before function failed"),
			expectCalls: 0,
		},
		{
			name: "fails with push error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(errors.New("push failed"))
			},
			opts:        repository.PushOptions{},
			wantError:   errors.New("push failed"),
			expectCalls: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, repository.CloneOptions{})

			err := stagedRepo.Push(context.Background(), tt.opts)

			if tt.wantError != nil {
				require.EqualError(t, err, tt.wantError.Error())
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.expectCalls, mockWriter.PushCallCount())
		})
	}
}

func TestStagedGitRepository_Remove(t *testing.T) {
	t.Run("succeeds with remove", func(t *testing.T) {
		mockWriter := &mocks.FakeStagedWriter{}
		stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, repository.CloneOptions{})

		err := stagedRepo.Remove(context.Background())

		require.NoError(t, err)
		// No mock calls expected since Remove is a no-op
	})
}

// Helper functions for creating test instances

func createTestStagedRepository(mockClient *mocks.FakeClient) *stagedGitRepository {
	mockWriter := &mocks.FakeStagedWriter{}
	return createTestStagedRepositoryWithWriter(mockWriter, repository.CloneOptions{}, mockClient)
}

func createTestStagedRepositoryWithWriter(mockWriter *mocks.FakeStagedWriter, opts repository.CloneOptions, mockClient ...*mocks.FakeClient) *stagedGitRepository {
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

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
		name        string
		setupMock   func(*mocks.FakeClient)
		opts        repository.CloneOptions
		wantError   bool
		expectCalls int
	}{
		{
			name: "success - basic creation",
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
			wantError:   false,
			expectCalls: 1,
		},
		{
			name: "success - with BeforeFn",
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
			wantError:   false,
			expectCalls: 1,
		},
		{
			name: "success - with timeout",
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
			wantError:   false,
			expectCalls: 1,
		},
		{
			name: "failure - BeforeFn error",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No setup needed as BeforeFn fails first
			},
			opts: repository.CloneOptions{
				BeforeFn: func() error {
					return errors.New("before function failed")
				},
			},
			wantError:   true,
			expectCalls: 0,
		},
		{
			name: "failure - GetRef error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("ref not found"))
			},
			opts: repository.CloneOptions{
				CreateIfNotExists: false,
				PushOnWrites:      false,
			},
			wantError:   true,
			expectCalls: 1,
		},
		{
			name: "failure - NewStagedWriter error",
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
			wantError:   true,
			expectCalls: 1,
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

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, stagedRepo)
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

			// Verify expected calls
			require.Equal(t, tt.expectCalls, mockClient.GetRefCallCount())
			if tt.expectCalls > 0 && !tt.wantError {
				require.Equal(t, 1, mockClient.NewStagedWriterCallCount())
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
		wantError bool
		errorMsg  string
	}{
		{
			name: "success - read file with empty ref",
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
			wantError: false,
		},
		{
			name: "success - read file with matching ref",
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
			wantError: false,
		},
		{
			name: "failure - unsupported ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No setup needed as error occurs before client calls
			},
			path:      "test.yaml",
			ref:       "feature-branch",
			wantError: true,
			errorMsg:  "ref is not supported for staged repository",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			stagedRepo := createTestStagedRepository(mockClient)

			fileInfo, err := stagedRepo.Read(context.Background(), tt.path, tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, fileInfo)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
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
		wantError bool
		errorMsg  string
	}{
		{
			name: "success - read tree with empty ref",
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
			wantError: false,
		},
		{
			name: "failure - unsupported ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No setup needed as error occurs before client calls
			},
			ref:       "feature-branch",
			wantError: true,
			errorMsg:  "ref is not supported for staged repository",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			stagedRepo := createTestStagedRepository(mockClient)

			entries, err := stagedRepo.ReadTree(context.Background(), tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, entries)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
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
		wantError  bool
		errorMsg   string
		expectPush bool
	}{
		{
			name: "success - create file without push",
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
			wantError:  false,
			expectPush: false,
		},
		{
			name: "success - create file with push",
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
			wantError:  false,
			expectPush: true,
		},
		{
			name: "failure - unsupported ref",
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
			wantError: true,
			errorMsg:  "ref is not supported for staged repository",
		},
		{
			name: "failure - create blob error",
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
			wantError: true,
		},
		{
			name: "failure - commit error",
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
			wantError: true,
		},
		{
			name: "failure - push error",
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
			wantError:  true,
			expectPush: true, // Push is still called even though it fails
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Create(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			if tt.wantError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if !tt.wantError || tt.errorMsg == "" {
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
		wantError  bool
		errorMsg   string
		expectPush bool
	}{
		{
			name: "success - write new file",
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
			wantError:  false,
			expectPush: false,
		},
		{
			name: "success - write existing file",
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
			wantError:  false,
			expectPush: true,
		},
		{
			name: "failure - unsupported ref",
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
			wantError: true,
			errorMsg:  "ref is not supported for staged repository",
		},
		{
			name: "failure - BlobExists error",
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
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Write(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			if tt.wantError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if !tt.wantError || tt.errorMsg == "" {
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
		wantError  bool
		errorMsg   string
		expectPush bool
	}{
		{
			name: "success - update file without push",
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
			wantError:  false,
			expectPush: false,
		},
		{
			name: "success - update file with push",
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
			wantError:  false,
			expectPush: true,
		},
		{
			name: "failure - unsupported ref",
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
			wantError: true,
			errorMsg:  "ref is not supported for staged repository",
		},
		{
			name: "failure - directory update",
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
			wantError: true,
			errorMsg:  "cannot update a directory in a staged repository",
		},
		{
			name: "failure - update blob error",
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
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Update(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			if tt.wantError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if !tt.wantError || tt.errorMsg == "" {
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
		wantError  bool
		errorMsg   string
		expectPush bool
	}{
		{
			name: "success - delete file without push",
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
			wantError:  false,
			expectPush: false,
		},
		{
			name: "success - delete directory with push",
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
			wantError:  false,
			expectPush: true,
		},
		{
			name: "failure - unsupported ref",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				// No setup needed as error occurs before writer calls
			},
			opts: repository.CloneOptions{
				PushOnWrites: false,
			},
			path:      "test.yaml",
			ref:       "feature-branch",
			message:   "Delete test file",
			wantError: true,
			errorMsg:  "ref is not supported for staged repository",
		},
		{
			name: "failure - delete blob error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.DeleteBlobReturns(hash.Hash{}, errors.New("delete blob failed"))
			},
			opts: repository.CloneOptions{
				PushOnWrites: false,
			},
			path:      "test.yaml",
			ref:       "",
			message:   "Delete test file",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, tt.opts)

			err := stagedRepo.Delete(context.Background(), tt.path, tt.ref, tt.message)

			if tt.wantError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
			}

			// Verify push behavior
			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else if !tt.wantError || tt.errorMsg == "" {
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
		wantError   bool
		expectCalls int
	}{
		{
			name: "success - basic push",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			opts:        repository.PushOptions{},
			wantError:   false,
			expectCalls: 1,
		},
		{
			name: "success - push with BeforeFn",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			opts: repository.PushOptions{
				BeforeFn: func() error {
					return nil
				},
			},
			wantError:   false,
			expectCalls: 1,
		},
		{
			name: "success - push with timeout",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(nil)
			},
			opts: repository.PushOptions{
				Timeout: time.Second * 5,
			},
			wantError:   false,
			expectCalls: 1,
		},
		{
			name: "failure - BeforeFn error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				// No setup needed as BeforeFn fails first
			},
			opts: repository.PushOptions{
				BeforeFn: func() error {
					return errors.New("before function failed")
				},
			},
			wantError:   true,
			expectCalls: 0,
		},
		{
			name: "failure - push error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.PushReturns(errors.New("push failed"))
			},
			opts:        repository.PushOptions{},
			wantError:   true,
			expectCalls: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			stagedRepo := createTestStagedRepositoryWithWriter(mockWriter, repository.CloneOptions{})

			err := stagedRepo.Push(context.Background(), tt.opts)

			if tt.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.expectCalls, mockWriter.PushCallCount())
		})
	}
}

func TestStagedGitRepository_Remove(t *testing.T) {
	t.Run("success - remove always succeeds", func(t *testing.T) {
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

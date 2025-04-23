package gogit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-billy/v5/memfs"
	"github.com/go-git/go-git/v5"
	plumbing "github.com/go-git/go-git/v5/plumbing"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type dummySecret struct{}

// Decrypt implements secrets.Service.
func (d *dummySecret) Decrypt(ctx context.Context, data []byte) ([]byte, error) {
	token, ok := os.LookupEnv("gitwraptoken")
	if !ok {
		return nil, fmt.Errorf("missing token in environment")
	}
	return []byte(token), nil
}

// Encrypt implements secrets.Service.
func (d *dummySecret) Encrypt(ctx context.Context, data []byte) ([]byte, error) {
	panic("unimplemented")
}

// FIXME!! NOTE!!!!!
// This is really just a sketchpad while trying to get things working
// the test makes destructive changes to a real git repository :)
// this should be removed before committing to main (likely sooner)
// and replaced with integration tests that check the more specific results
func TestGoGitWrapper(t *testing.T) {
	_, ok := os.LookupEnv("gitwraptoken")
	if !ok {
		t.Skipf("no token found in environment")
	}

	ctx := context.Background()
	wrap, err := Clone(ctx, "testdata/clone", &v0alpha1.Repository{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "ns",
			Name:      "unit-tester",
		},
		Spec: v0alpha1.RepositorySpec{
			GitHub: &v0alpha1.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/git-ui-sync-demo",
				Branch: "ryan-test",
			},
		},
	},
		repository.CloneOptions{
			PushOnWrites:      false,
			CreateIfNotExists: true,
			Progress:          os.Stdout,
		},
		&dummySecret{},
	)
	require.NoError(t, err)

	tree, err := wrap.ReadTree(ctx, "")
	require.NoError(t, err)

	jj, err := json.MarshalIndent(tree, "", "  ")
	require.NoError(t, err)

	fmt.Printf("TREE:%s\n", string(jj))

	ctx = repository.WithAuthorSignature(ctx, repository.CommitSignature{
		Name:  "xxxxx",
		Email: "rrr@yyyy.zzz",
		When:  time.Now(),
	})

	for i := 0; i < 10; i++ {
		fname := fmt.Sprintf("deep/path/in/test_%d.txt", i)
		fmt.Printf("Write:%s\n", fname)
		err = wrap.Write(ctx, fname, "", []byte(fmt.Sprintf("body/%d %s", i, time.Now())), "the commit message")
		require.NoError(t, err)
	}

	fmt.Printf("push...\n")
	err = wrap.Push(ctx, repository.PushOptions{
		Timeout:  10,
		Progress: os.Stdout,
	})
	require.NoError(t, err)
}

func TestReadTree(t *testing.T) {
	dir := t.TempDir()
	gitRepo, err := git.PlainInit(dir, false)
	require.NoError(t, err, "failed to init a new git repository")
	tree, err := gitRepo.Worktree()
	require.NoError(t, err, "failed to get worktree")

	repo := &GoGitRepo{
		config: &v0alpha1.Repository{
			ObjectMeta: v1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
			Spec: v0alpha1.RepositorySpec{
				Title:     "test",
				Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
				Type:      v0alpha1.GitHubRepositoryType,
				GitHub: &v0alpha1.GitHubRepositoryConfig{
					URL:    "https://github.com/grafana/__unit-test",
					Path:   "grafana/",
					Branch: "main",
				},
			},
			Status: v0alpha1.RepositoryStatus{},
		},
		decryptedPassword: "password",

		repo: gitRepo,
		tree: &worktree{
			Worktree: tree,
		},
		dir: dir,
	}

	err = os.WriteFile(filepath.Join(dir, "test.txt"), []byte("test"), 0644)
	require.NoError(t, err, "failed to write test file")

	err = os.Mkdir(filepath.Join(dir, "grafana"), 0750)
	require.NoError(t, err, "failed to mkdir grafana")

	err = os.WriteFile(filepath.Join(dir, "grafana", "test2.txt"), []byte("test"), 0644)
	require.NoError(t, err, "failed to write grafana/test2 file")

	ctx := context.Background()
	entries, err := repo.ReadTree(ctx, "HEAD")
	require.NoError(t, err, "failed to read tree")

	// Here is the meat of why this test exists: the ReadTree call should only read the config.Spec.GitHub.Path files.
	// All prefixes are removed (i.e. a file is just its name, not ${Path}/${Name}).
	// And it does not include the directory in the listing, as it pretends to be the root.
	require.Len(t, entries, 1, "entries from ReadTree")
	require.Equal(t, entries[0].Path, "test2.txt", "entry path")
}

func TestGoGitRepo_History(t *testing.T) {
	repo := &GoGitRepo{
		config: &v0alpha1.Repository{
			ObjectMeta: v1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
			Spec: v0alpha1.RepositorySpec{
				GitHub: &v0alpha1.GitHubRepositoryConfig{
					Path: "grafana/",
				},
			},
		},
	}

	// Test History method
	ctx := context.Background()
	_, err := repo.History(ctx, "test.txt", "")
	require.Error(t, err, "History should return an error as it's not implemented")
	require.Contains(t, err.Error(), "history is not yet implemented")
}

func TestGoGitRepo_Validate(t *testing.T) {
	repo := &GoGitRepo{
		config: &v0alpha1.Repository{
			ObjectMeta: v1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
			Spec: v0alpha1.RepositorySpec{
				GitHub: &v0alpha1.GitHubRepositoryConfig{
					Path: "grafana/",
				},
			},
		},
	}

	// Test Validate method
	errs := repo.Validate()
	require.Empty(t, errs, "Validate should return no errors")
}

func TestGoGitRepo_Webhook(t *testing.T) {
	repo := &GoGitRepo{
		config: &v0alpha1.Repository{
			ObjectMeta: v1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
			Spec: v0alpha1.RepositorySpec{
				GitHub: &v0alpha1.GitHubRepositoryConfig{
					Path: "grafana/",
				},
			},
		},
	}

	// Test Webhook method
	ctx := context.Background()
	_, err := repo.Webhook(ctx, nil)
	require.Error(t, err, "Webhook should return an error as it's not implemented")
	var statusErr *apierrors.StatusError
	require.True(t, errors.As(err, &statusErr), "Error should be a StatusError")
	require.Equal(t, http.StatusNotImplemented, int(statusErr.ErrStatus.Code))
	require.Contains(t, statusErr.ErrStatus.Message, "history is not yet implemented")
}

func TestGoGitRepo_Read(t *testing.T) {
	// Setup test cases
	tests := []struct {
		name        string
		path        string
		ref         string
		setupMock   func(fs billy.Filesystem)
		expectError bool
		errorType   error
		checkResult func(t *testing.T, info *repository.FileInfo)
	}{
		{
			name: "successfully read file",
			path: "test.txt",
			ref:  "",
			setupMock: func(fs billy.Filesystem) {
				// Create a test file
				f, err := fs.Create("grafana/test.txt")
				require.NoError(t, err, "failed to create test file")
				_, err = f.Write([]byte("test content"))
				require.NoError(t, err, "failed to write test content")
				err = f.Close()
				require.NoError(t, err, "failed to close test file")
			},
			expectError: false,
			checkResult: func(t *testing.T, info *repository.FileInfo) {
				require.Equal(t, "test.txt", info.Path)
				require.Equal(t, "test content", string(info.Data))
				require.NotNil(t, info.Modified)
			},
		},
		{
			name:        "empty path",
			path:        "",
			ref:         "",
			setupMock:   func(fs billy.Filesystem) {},
			expectError: true,
			errorType:   fmt.Errorf("expected path"),
		},
		{
			name:        "ref not supported",
			path:        "test.txt",
			ref:         "main",
			setupMock:   func(fs billy.Filesystem) {},
			expectError: true,
			errorType:   fmt.Errorf("ref unsupported"),
		},
		{
			name: "file not found",
			path: "nonexistent.txt",
			ref:  "",
			setupMock: func(fs billy.Filesystem) {
				// Don't create the file
			},
			expectError: true,
			errorType:   repository.ErrFileNotFound,
		},
		{
			name: "read directory",
			path: "testdir",
			ref:  "",
			setupMock: func(fs billy.Filesystem) {
				// Create a test directory
				err := fs.MkdirAll("grafana/testdir", 0755)
				require.NoError(t, err, "failed to create test directory")
			},
			expectError: false,
			checkResult: func(t *testing.T, info *repository.FileInfo) {
				require.Equal(t, "testdir", info.Path)
				require.Nil(t, info.Data)
				require.NotNil(t, info.Modified)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup filesystem and repo
			fs := memfs.New()
			tt.setupMock(fs)

			// Create a worktree with the filesystem
			repo := &GoGitRepo{
				config: &v0alpha1.Repository{
					Spec: v0alpha1.RepositorySpec{
						GitHub: &v0alpha1.GitHubRepositoryConfig{
							Path: "grafana/",
						},
					},
				},
				tree: &worktree{
					Worktree: &git.Worktree{
						Filesystem: fs,
					},
				},
			}

			// Test Read method
			ctx := context.Background()
			info, err := repo.Read(ctx, tt.path, tt.ref)

			// Check results
			if tt.expectError {
				require.Error(t, err)
				if tt.errorType != nil {
					if errors.Is(tt.errorType, repository.ErrFileNotFound) {
						require.ErrorIs(t, err, repository.ErrFileNotFound)
					} else {
						require.Contains(t, err.Error(), tt.errorType.Error())
					}
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, info)
				tt.checkResult(t, info)
			}
		})
	}
}

func TestGoGitRepo_Delete(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		ref         string
		pushOnWrite bool
		setupMock   func(mockTree *MockWorktree)
		expectError bool
		errorType   error
	}{
		{
			name:        "delete existing file",
			path:        "testfile.txt",
			ref:         "",
			pushOnWrite: false,
			setupMock: func(mockTree *MockWorktree) {
				mockTree.On("Remove", "grafana/testfile.txt").Return(plumbing.Hash{}, nil)
			},
			expectError: false,
		},
		{
			name:        "delete non-existent file",
			path:        "nonexistent.txt",
			ref:         "",
			pushOnWrite: false,
			setupMock: func(mockTree *MockWorktree) {
				mockTree.On("Remove", "grafana/nonexistent.txt").Return(plumbing.Hash{}, fs.ErrNotExist)
			},
			expectError: true,
			errorType:   repository.ErrFileNotFound,
		},
		{
			name:        "delete with other error",
			path:        "testfile.txt",
			ref:         "",
			pushOnWrite: false,
			setupMock: func(mockTree *MockWorktree) {
				mockTree.On("Remove", "grafana/testfile.txt").Return(plumbing.Hash{}, fmt.Errorf("some other error"))
			},
			expectError: true,
			errorType:   fmt.Errorf("some other error"),
		},
		{
			name:        "empty path",
			path:        "",
			ref:         "",
			pushOnWrite: false,
			setupMock:   func(mockTree *MockWorktree) {},
			expectError: true,
			errorType:   fmt.Errorf("expected path"),
		},
		{
			name:        "with ref",
			path:        "testfile.txt",
			ref:         "main",
			pushOnWrite: false,
			setupMock: func(mockTree *MockWorktree) {
			},
			expectError: true,
			errorType:   fmt.Errorf("ref unsupported"),
		},
		{
			name:        "delete with push on write enabled",
			path:        "testfile.txt",
			ref:         "",
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				mockTree.On("Remove", "grafana/testfile.txt").Return(plumbing.Hash{}, nil)
				mockTree.On("Commit", "test delete", mock.MatchedBy(func(opts *git.CommitOptions) bool {
					return opts.Author != nil &&
						opts.Author.Name == "Test User" &&
						opts.Author.Email == "test@example.com" &&
						opts.Author.When.After(time.Now().Add(-time.Minute)) &&
						opts.Author.When.Before(time.Now().Add(time.Minute))
				})).Return(plumbing.Hash{}, nil)
			},
			expectError: false,
		},
		{
			name:        "delete with empty commit",
			path:        "testfile.txt",
			ref:         "",
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				mockTree.On("Remove", "grafana/testfile.txt").Return(plumbing.Hash{}, nil)
				mockTree.On("Commit", "test delete", mock.MatchedBy(func(opts *git.CommitOptions) bool {
					return opts.Author != nil &&
						opts.Author.Name == "Test User" &&
						opts.Author.Email == "test@example.com" &&
						opts.Author.When.After(time.Now().Add(-time.Minute)) &&
						opts.Author.When.Before(time.Now().Add(time.Minute))
				})).Return(plumbing.Hash{}, git.ErrEmptyCommit)
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup filesystem and repo

			mockTree := NewMockWorktree(t)
			tt.setupMock(mockTree)

			// Create a worktree with the filesystem
			repo := &GoGitRepo{
				config: &v0alpha1.Repository{
					Spec: v0alpha1.RepositorySpec{
						GitHub: &v0alpha1.GitHubRepositoryConfig{
							Path: "grafana/",
						},
					},
				},
				tree: mockTree,
				opts: repository.CloneOptions{
					PushOnWrites: tt.pushOnWrite,
				},
			}

			// Test Delete method
			ctx := context.Background()
			// Set author signature for the test
			ctx = repository.WithAuthorSignature(ctx, repository.CommitSignature{
				Name:  "Test User",
				Email: "test@example.com",
				When:  time.Now(),
			})

			err := repo.Delete(ctx, tt.path, tt.ref, "test delete")

			// Check results
			if tt.expectError {
				require.Error(t, err)
				if tt.errorType != nil {
					if errors.Is(tt.errorType, repository.ErrFileNotFound) {
						require.ErrorIs(t, err, repository.ErrFileNotFound)
					} else {
						require.Contains(t, err.Error(), tt.errorType.Error())
					}
				}
			} else {
				require.NoError(t, err)
			}

			mockTree.AssertExpectations(t)
		})
	}
}

// FIXME: missing coverage for Update / Create because we use Write for both
// when I think it shouldn't be the case as it's inconsistent with the other repository implementations
func TestGoGitRepo_Write(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		ref         string
		data        []byte
		pushOnWrite bool
		setupMock   func(mockTree *MockWorktree)
		expectError bool
		errorType   error
	}{
		{
			name:        "successful write",
			path:        "test.txt",
			ref:         "",
			data:        []byte("test content"),
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				fs := memfs.New()
				mockTree.On("Filesystem").Return(fs)
				mockTree.On("Add", "grafana/test.txt").Return(plumbing.NewHash("abc123"), nil)
				mockTree.On("Commit", "test write", mock.MatchedBy(func(opts *git.CommitOptions) bool {
					return opts.Author != nil &&
						opts.Author.Name == "Test User" &&
						opts.Author.Email == "test@example.com" &&
						opts.Author.When.After(time.Now().Add(-time.Minute)) &&
						opts.Author.When.Before(time.Now().Add(time.Minute))
				})).Return(plumbing.NewHash("def456"), nil)
			},
			expectError: false,
		},
		{
			name:        "create folder only",
			path:        "testdir/",
			ref:         "",
			data:        []byte{},
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				fs := memfs.New()
				mockTree.On("Filesystem").Return(fs)
				// No Add or Commit calls expected for directory creation
			},
			expectError: false,
		},
		{
			name:        "successful write without commit",
			path:        "test.txt",
			ref:         "",
			data:        []byte("test content"),
			pushOnWrite: false,
			setupMock: func(mockTree *MockWorktree) {
				fs := memfs.New()
				mockTree.On("Filesystem").Return(fs)
				mockTree.On("Add", "grafana/test.txt").Return(plumbing.NewHash("abc123"), nil)
			},
			expectError: false,
		},
		{
			name:        "write with directory creation",
			path:        "dir/test.txt",
			ref:         "",
			data:        []byte("test content"),
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				fs := memfs.New()
				mockTree.On("Filesystem").Return(fs)
				mockTree.On("Add", "grafana/dir/test.txt").Return(plumbing.NewHash("abc123"), nil)
				mockTree.On("Commit", "test write", mock.Anything).Return(plumbing.NewHash("def456"), nil)
			},
			expectError: false,
		},
		{
			name:        "error on add",
			path:        "test.txt",
			ref:         "",
			data:        []byte("test content"),
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				fs := memfs.New()
				mockTree.On("Filesystem").Return(fs)
				mockTree.On("Add", "grafana/test.txt").Return(plumbing.NewHash(""), fmt.Errorf("add error"))
			},
			expectError: true,
			errorType:   fmt.Errorf("add error"),
		},
		{
			name:        "error with ref",
			path:        "test.txt",
			ref:         "main",
			data:        []byte("test content"),
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				// No mock setup needed as it should fail before using the mock
			},
			expectError: true,
			errorType:   fmt.Errorf("ref unsupported"),
		},
		{
			name:        "empty path",
			path:        "",
			ref:         "",
			data:        []byte("test content"),
			pushOnWrite: true,
			setupMock: func(mockTree *MockWorktree) {
				// No mock setup needed as it should fail before using the mock
			},
			expectError: true,
			errorType:   fmt.Errorf("expected path"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup filesystem and repo
			mockTree := NewMockWorktree(t)
			tt.setupMock(mockTree)

			// Create a worktree with the filesystem
			repo := &GoGitRepo{
				config: &v0alpha1.Repository{
					Spec: v0alpha1.RepositorySpec{
						GitHub: &v0alpha1.GitHubRepositoryConfig{
							Path: "grafana/",
						},
					},
				},
				tree: mockTree,
				opts: repository.CloneOptions{
					PushOnWrites: tt.pushOnWrite,
				},
			}

			// Test Write method
			ctx := context.Background()
			// Set author signature for the test
			ctx = repository.WithAuthorSignature(ctx, repository.CommitSignature{
				Name:  "Test User",
				Email: "test@example.com",
				When:  time.Now(),
			})

			err := repo.Update(ctx, tt.path, tt.ref, tt.data, "test write")

			// Check results
			if tt.expectError {
				require.Error(t, err)
				if tt.errorType != nil {
					require.Contains(t, err.Error(), tt.errorType.Error())
				}
			} else {
				require.NoError(t, err)
			}

			mockTree.AssertExpectations(t)
		})
	}
}

func TestGoGitRepo_Test(t *testing.T) {
	tests := []struct {
		name            string
		treeInitialized bool
		expectedResult  bool
	}{
		{
			name:            "tree is initialized",
			treeInitialized: true,
			expectedResult:  true,
		},
		{
			name:            "tree is not initialized",
			treeInitialized: false,
			expectedResult:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock tree
			mockTree := NewMockWorktree(t)

			// Create repo with or without initialized tree
			repo := &GoGitRepo{
				config: &v0alpha1.Repository{
					Spec: v0alpha1.RepositorySpec{
						GitHub: &v0alpha1.GitHubRepositoryConfig{
							Path: "grafana/",
						},
					},
				},
				tree: nil,
			}

			if tt.treeInitialized {
				repo.tree = mockTree
			}

			// Test the Test method
			ctx := context.Background()
			result, err := repo.Test(ctx)

			// Verify results
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Equal(t, tt.expectedResult, result.Success)
		})
	}
}

func TestGoGitRepo_Config(t *testing.T) {
	// Create a test repository configuration
	testConfig := &v0alpha1.Repository{
		ObjectMeta: v1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			GitHub: &v0alpha1.GitHubRepositoryConfig{
				Path: "grafana/",
			},
		},
	}

	// Create a repository instance with the test configuration
	repo := &GoGitRepo{
		config: testConfig,
		tree:   NewMockWorktree(t),
	}

	// Call the Config method
	result := repo.Config()

	// Verify the result
	require.NotNil(t, result)
	require.Equal(t, testConfig, result)
	require.Equal(t, "test-repo", result.Name)
	require.Equal(t, "test-namespace", result.Namespace)
	require.Equal(t, "grafana/", result.Spec.GitHub.Path)
}

func TestGoGitRepo_Remove(t *testing.T) {
	tests := []struct {
		name           string
		setupMock      func(t *testing.T) (*GoGitRepo, string)
		expectError    bool
		expectedErrMsg string
	}{
		{
			name: "successful removal",
			setupMock: func(t *testing.T) (*GoGitRepo, string) {
				// Create a temporary directory that will be removed
				tempDir, err := os.MkdirTemp("", "test-repo-*")
				require.NoError(t, err)

				// Create a repository instance
				repo := &GoGitRepo{
					dir: tempDir,
					config: &v0alpha1.Repository{
						ObjectMeta: v1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "test-namespace",
						},
					},
				}

				return repo, tempDir
			},
			expectError: false,
		},
		{
			name: "directory already removed",
			setupMock: func(t *testing.T) (*GoGitRepo, string) {
				// Create a temporary directory
				tempDir, err := os.MkdirTemp("", "test-repo-*")
				require.NoError(t, err)

				// Remove it immediately to simulate it being already gone
				err = os.RemoveAll(tempDir)
				require.NoError(t, err)

				// Create a repository instance pointing to the removed directory
				repo := &GoGitRepo{
					dir: tempDir,
					config: &v0alpha1.Repository{
						ObjectMeta: v1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "test-namespace",
						},
					},
				}

				return repo, tempDir
			},
			expectError: false, // RemoveAll doesn't error if directory doesn't exist
		},
		{
			name: "invalid directory path",
			setupMock: func(t *testing.T) (*GoGitRepo, string) {
				// Create a repository instance with an invalid directory path
				// that should cause an error when trying to remove
				invalidPath := string([]byte{0})

				repo := &GoGitRepo{
					dir: invalidPath,
					config: &v0alpha1.Repository{
						ObjectMeta: v1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "test-namespace",
						},
					},
				}

				return repo, invalidPath
			},
			expectError:    true,
			expectedErrMsg: "invalid argument",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup the test
			repo, _ := tt.setupMock(t)

			// Test the Remove method
			ctx := context.Background()
			err := repo.Remove(ctx)

			// Verify results
			if tt.expectError {
				require.Error(t, err)
				if tt.expectedErrMsg != "" {
					require.Contains(t, err.Error(), tt.expectedErrMsg)
				}
			} else {
				require.NoError(t, err)
				// Verify the directory no longer exists
				_, statErr := os.Stat(repo.dir)
				require.True(t, os.IsNotExist(statErr), "Directory should not exist after removal")
			}
		})
	}
}

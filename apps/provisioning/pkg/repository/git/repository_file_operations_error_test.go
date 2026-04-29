package git

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/nanogit"
	"github.com/grafana/nanogit/mocks"
	"github.com/grafana/nanogit/protocol/client"
	"github.com/grafana/nanogit/protocol/hash"
)

// TestFileOperations_HTTPErrorMapping verifies that HTTP auth/permission errors
// from nanogit are properly mapped to repository errors with correct status codes
func TestFileOperations_HTTPErrorMapping(t *testing.T) {
	testCases := []struct {
		name           string
		nanogitError   error
		wantStatusCode int32
		wantRepoError  error
	}{
		{
			name:           "unauthorized (401) error",
			nanogitError:   client.NewUnauthorizedError("GET", "/info/refs", nil),
			wantStatusCode: http.StatusUnauthorized,
			wantRepoError:  repository.ErrUnauthorized,
		},
		{
			name:           "permission denied (403) error",
			nanogitError:   client.NewPermissionDeniedError("POST", "/git-receive-pack", nil),
			wantStatusCode: http.StatusForbidden,
			wantRepoError:  repository.ErrPermissionDenied,
		},
		{
			name:           "server unavailable (503) error",
			nanogitError:   client.NewServerUnavailableError("GET", 503, nil),
			wantStatusCode: http.StatusServiceUnavailable,
			wantRepoError:  repository.ErrServerUnavailable,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test Read operation
			t.Run("Read", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.GetCommitReturns(nil, tc.nanogitError)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				_, err := gitRepo.Read(context.Background(), "test.yaml", "main")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test ReadTree operation
			t.Run("ReadTree", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, tc.nanogitError)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				_, err := gitRepo.ReadTree(context.Background(), "main")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Create operation - NewStagedWriter error
			t.Run("Create_StagedWriter", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.NewStagedWriterReturns(nil, tc.nanogitError)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Create(context.Background(), "test.yaml", "main", []byte("data"), "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Create operation - Push error
			t.Run("Create_Push", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.CreateBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(tc.nanogitError)
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Create(context.Background(), "test.yaml", "main", []byte("data"), "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Update operation - NewStagedWriter error
			t.Run("Update_StagedWriter", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.NewStagedWriterReturns(nil, tc.nanogitError)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Update(context.Background(), "test.yaml", "main", []byte("data"), "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Update operation - Push error
			t.Run("Update_Push", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.UpdateBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(tc.nanogitError)
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Update(context.Background(), "test.yaml", "main", []byte("data"), "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Delete operation - NewStagedWriter error
			t.Run("Delete_StagedWriter", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.NewStagedWriterReturns(nil, tc.nanogitError)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Delete(context.Background(), "test.yaml", "main", "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Delete operation - Push error
			t.Run("Delete_Push", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.DeleteBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(tc.nanogitError)
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Delete(context.Background(), "test.yaml", "main", "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Move operation - NewStagedWriter error
			t.Run("Move_StagedWriter", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.NewStagedWriterReturns(nil, tc.nanogitError)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Move(context.Background(), "old.yaml", "new.yaml", "main", "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})

			// Test Move operation - Push error
			t.Run("Move_Push", func(t *testing.T) {
				mockClient := &mocks.FakeClient{}
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.MoveBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(tc.nanogitError)
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				gitRepo := &gitRepository{
					client: mockClient,
					gitConfig: RepositoryConfig{
						Branch: "main",
						Path:   "configs",
					},
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Type: provisioning.GitHubRepositoryType,
						},
					},
				}

				err := gitRepo.Move(context.Background(), "old.yaml", "new.yaml", "main", "commit")
				verifyHTTPError(t, err, tc.wantRepoError, tc.wantStatusCode)
			})
		})
	}
}

// verifyHTTPError checks that an error wraps the expected repository error
// and has the correct HTTP status code
func verifyHTTPError(t *testing.T, err error, wantRepoError error, wantStatusCode int32) {
	t.Helper()

	require.Error(t, err, "expected an error")
	require.ErrorIs(t, err, wantRepoError, "error should wrap the expected repository error")

	// Verify HTTP status code using k8s StatusError interface
	var statusErr apierrors.APIStatus
	if errors.As(err, &statusErr) {
		require.Equal(t, wantStatusCode, statusErr.Status().Code,
			"mapped error should have correct HTTP status code")
	} else {
		t.Fatalf("error should implement APIStatus interface, got: %T", err)
	}
}

// TestFileOperations_PreservesSpecificErrorHandling verifies that specific
// error handling (like ErrObjectNotFound -> ErrFileNotFound) is preserved
func TestFileOperations_PreservesSpecificErrorHandling(t *testing.T) {
	t.Run("Read preserves ErrFileNotFound", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{},
		}, nil)
		mockClient.GetCommitReturns(&nanogit.Commit{
			Tree: hash.Hash{},
		}, nil)
		mockClient.GetBlobByPathReturns(nil, nanogit.ErrObjectNotFound)

		gitRepo := &gitRepository{
			client: mockClient,
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
		}

		_, err := gitRepo.Read(context.Background(), "missing.yaml", "main")
		require.ErrorIs(t, err, repository.ErrFileNotFound)
	})

	t.Run("ReadTree preserves ErrRefNotFound", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{}, nanogit.ErrObjectNotFound)

		gitRepo := &gitRepository{
			client: mockClient,
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
		}

		_, err := gitRepo.ReadTree(context.Background(), "main")
		require.ErrorIs(t, err, repository.ErrRefNotFound)
	})

	t.Run("Create preserves ErrFileAlreadyExists", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{},
		}, nil)
		mockWriter := &mocks.FakeStagedWriter{}
		mockWriter.CreateBlobReturns(hash.Hash{}, nanogit.ErrObjectAlreadyExists)
		mockClient.NewStagedWriterReturns(mockWriter, nil)

		gitRepo := &gitRepository{
			client: mockClient,
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
		}

		err := gitRepo.Create(context.Background(), "existing.yaml", "main", []byte("data"), "commit")
		require.ErrorIs(t, err, repository.ErrFileAlreadyExists)
	})

	t.Run("Update preserves ErrFileNotFound", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{},
		}, nil)
		mockWriter := &mocks.FakeStagedWriter{}
		mockWriter.UpdateBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
		mockClient.NewStagedWriterReturns(mockWriter, nil)

		gitRepo := &gitRepository{
			client: mockClient,
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
		}

		err := gitRepo.Update(context.Background(), "missing.yaml", "main", []byte("data"), "commit")
		require.ErrorIs(t, err, repository.ErrFileNotFound)
	})

	t.Run("Delete preserves ErrFileNotFound", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{},
		}, nil)
		mockWriter := &mocks.FakeStagedWriter{}
		mockWriter.DeleteBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
		mockClient.NewStagedWriterReturns(mockWriter, nil)

		gitRepo := &gitRepository{
			client: mockClient,
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
		}

		err := gitRepo.Delete(context.Background(), "missing.yaml", "main", "commit")
		require.ErrorIs(t, err, repository.ErrFileNotFound)
	})

	t.Run("Move preserves ErrFileNotFound", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{},
		}, nil)
		mockWriter := &mocks.FakeStagedWriter{}
		mockWriter.MoveBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
		mockClient.NewStagedWriterReturns(mockWriter, nil)

		gitRepo := &gitRepository{
			client: mockClient,
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
		}

		err := gitRepo.Move(context.Background(), "missing.yaml", "new.yaml", "main", "commit")
		require.ErrorIs(t, err, repository.ErrFileNotFound)
	})

	t.Run("Move preserves ErrFileAlreadyExists", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{},
		}, nil)
		mockWriter := &mocks.FakeStagedWriter{}
		mockWriter.MoveBlobReturns(hash.Hash{}, nanogit.ErrObjectAlreadyExists)
		mockClient.NewStagedWriterReturns(mockWriter, nil)

		gitRepo := &gitRepository{
			client: mockClient,
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
		}

		err := gitRepo.Move(context.Background(), "old.yaml", "existing.yaml", "main", "commit")
		require.ErrorIs(t, err, repository.ErrFileAlreadyExists)
	})
}

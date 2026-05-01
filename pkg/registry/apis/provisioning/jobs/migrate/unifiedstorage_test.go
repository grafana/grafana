package migrate

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestUnifiedStorageMigrator_Migrate(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockNamespaceCleaner, *jobs.MockWorker, *jobs.MockWorker, *jobs.MockJobProgressRecorder, *repository.MockRepository)
		expectedError string
	}{
		{
			name: "should fail when export job fails",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(errors.New("export failed"))
			},
			expectedError: "export resources: export failed",
		},
		{
			name: "should fail when sync job fails",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(nil)
				pr.On("ResetResults", false).Return()
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(errors.New("sync failed"))
			},
			expectedError: "pull resources: sync failed",
		},
		{
			name: "should fail when resource cleanup fails",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				nc.On("Clean", mock.Anything, "test-namespace", pr).Return(errors.New("clean failed"))

				// Export and sync jobs succeed
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(nil)
				pr.On("ResetResults", false).Return()
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(nil)
				pr.On("SetMessage", mock.Anything, "clean namespace").Return()
			},
			expectedError: "clean namespace: clean failed",
		},
		{
			name: "should succeed with complete workflow",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				// Export job succeeds
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(nil)

				nc.On("Clean", mock.Anything, "test-namespace", pr).Return(nil)
				// Reset progress and sync job succeeds
				pr.On("ResetResults", false).Return()
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(nil)

				pr.On("SetMessage", mock.Anything, "clean namespace").Return()
			},
			expectedError: "",
		},
		{
			name: "should run export and sync for folder-type repositories",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				})
				// Export should run for folder-type repositories
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(nil)
				pr.On("ResetResults", false).Return()
				// Cleaner should be skipped - no cleaner-related mocks
				// Sync job should run
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(nil)
			},
			expectedError: "",
		},
		{
			name: "should fail when sync job fails for folder-type repositories",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				})
				// Export should run first
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(nil)
				pr.On("ResetResults", false).Return()
				// Sync job should run and fail
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(errors.New("folder sync failed"))
			},
			expectedError: "pull resources: folder sync failed",
		},
		{
			name: "should run complete workflow for instance-type repositories",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
				// Export should run for instance repositories
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(nil)
				pr.On("ResetResults", false).Return()

				// Sync job and cleanup should also run
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(nil)
				pr.On("SetMessage", mock.Anything, "clean namespace").Return()
				nc.On("Clean", mock.Anything, "test-namespace", pr).Return(nil)
			},
			expectedError: "",
		},
		{
			name: "should handle empty target type as instance",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: "", // Empty target should default to instance behavior
						},
					},
				})
				// Should run full workflow like instance type
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), mock.Anything).Return(nil)
				pr.On("ResetResults", false).Return()
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(nil)
				pr.On("SetMessage", mock.Anything, "clean namespace").Return()
				nc.On("Clean", mock.Anything, "test-namespace", pr).Return(nil)
			},
			expectedError: "",
		},
		{
			name: "should pass migrate options to export job",
			setupMocks: func(nc *MockNamespaceCleaner, ew *jobs.MockWorker, sw *jobs.MockWorker, pr *jobs.MockJobProgressRecorder, rw *repository.MockRepository) {
				rw.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				// Verify that the export job receives the migrate message
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil && job.Spec.Push.Message == "test migration message"
				}), mock.Anything).Return(nil)
				pr.On("ResetResults", false).Return()
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(nil)
				pr.On("SetMessage", mock.Anything, "clean namespace").Return()
				nc.On("Clean", mock.Anything, "test-namespace", pr).Return(nil)
			},
			expectedError: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exportWorker := jobs.NewMockWorker(t)
			syncWorker := jobs.NewMockWorker(t)
			progressRecorder := jobs.NewMockJobProgressRecorder(t)
			readerWriter := repository.NewMockRepository(t)
			mockNamespaceCleaner := NewMockNamespaceCleaner(t)

			if tt.setupMocks != nil {
				tt.setupMocks(mockNamespaceCleaner, exportWorker, syncWorker, progressRecorder, readerWriter)
			}

			migrator := NewUnifiedStorageMigrator(mockNamespaceCleaner, exportWorker, syncWorker)

			var migrateOptions provisioning.MigrateJobOptions
			if tt.name == "should pass migrate options to export job" {
				migrateOptions = provisioning.MigrateJobOptions{
					Message: "test migration message",
				}
			}

			err := migrator.Migrate(context.Background(), readerWriter, migrateOptions, progressRecorder)

			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mock.AssertExpectationsForObjects(t, mockNamespaceCleaner, exportWorker, syncWorker, progressRecorder, readerWriter)
		})
	}
}

func TestUnifiedStorageMigrator_TakeoverAllowlist(t *testing.T) {
	testGVK := schema.GroupVersionKind{Group: "dashboard.grafana.app", Version: "v1", Kind: "Dashboard"}

	t.Run("export wraps progress recorder with collector that populates allowlist", func(t *testing.T) {
		exportWorker := jobs.NewMockWorker(t)
		syncWorker := jobs.NewMockWorker(t)
		pr := jobs.NewMockJobProgressRecorder(t)
		repo := repository.NewMockRepository(t)
		nc := NewMockNamespaceCleaner(t)

		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "test-ns"},
			Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance}},
		})
		pr.On("SetMessage", mock.Anything, mock.Anything).Return()
		pr.On("StrictMaxErrors", 1).Return()
		pr.On("ResetResults", false).Return()

		pr.On("Record", mock.Anything, mock.Anything).Return()

		exportWorker.On("Process", mock.Anything, repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Push != nil
		}), mock.Anything).Run(func(args mock.Arguments) {
			collector, ok := args.Get(3).(jobs.JobProgressRecorder)
			require.True(t, ok, "export should receive a JobProgressRecorder (collector wrapper)")

			collector.Record(args.Get(0).(context.Context), jobs.NewGVKResult("dash-1", testGVK).
				WithAction(repository.FileActionCreated).Build())
			collector.Record(args.Get(0).(context.Context), jobs.NewGVKResult("dash-2", testGVK).
				WithAction(repository.FileActionCreated).Build())
		}).Return(nil)

		syncWorker.On("Process", mock.MatchedBy(func(ctx context.Context) bool {
			al := resources.TakeoverAllowlistFromContext(ctx)
			if al == nil {
				return false
			}
			return al.Contains(resources.ResourceIdentifier{Name: "dash-1", Group: "dashboard.grafana.app", Kind: "Dashboard"}) &&
				al.Contains(resources.ResourceIdentifier{Name: "dash-2", Group: "dashboard.grafana.app", Kind: "Dashboard"})
		}), repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil
		}), pr).Return(nil)

		nc.On("Clean", mock.Anything, "test-ns", pr).Return(nil)

		migrator := NewUnifiedStorageMigrator(nc, exportWorker, syncWorker)
		err := migrator.Migrate(context.Background(), repo, provisioning.MigrateJobOptions{}, pr)
		require.NoError(t, err)
	})

	t.Run("allowlist is empty when export records no successful resources", func(t *testing.T) {
		exportWorker := jobs.NewMockWorker(t)
		syncWorker := jobs.NewMockWorker(t)
		pr := jobs.NewMockJobProgressRecorder(t)
		repo := repository.NewMockRepository(t)
		nc := NewMockNamespaceCleaner(t)

		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "test-ns"},
			Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance}},
		})
		pr.On("SetMessage", mock.Anything, mock.Anything).Return()
		pr.On("StrictMaxErrors", 1).Return()
		pr.On("ResetResults", false).Return()

		exportWorker.On("Process", mock.Anything, repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Push != nil
		}), mock.Anything).Return(nil)

		syncWorker.On("Process", mock.MatchedBy(func(ctx context.Context) bool {
			al := resources.TakeoverAllowlistFromContext(ctx)
			return al != nil && !al.Contains(resources.ResourceIdentifier{Name: "any", Group: "any", Kind: "any"})
		}), repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil
		}), pr).Return(nil)

		nc.On("Clean", mock.Anything, "test-ns", pr).Return(nil)

		migrator := NewUnifiedStorageMigrator(nc, exportWorker, syncWorker)
		err := migrator.Migrate(context.Background(), repo, provisioning.MigrateJobOptions{}, pr)
		require.NoError(t, err)
	})

	t.Run("only successfully exported resources appear in allowlist", func(t *testing.T) {
		exportWorker := jobs.NewMockWorker(t)
		syncWorker := jobs.NewMockWorker(t)
		pr := jobs.NewMockJobProgressRecorder(t)
		repo := repository.NewMockRepository(t)
		nc := NewMockNamespaceCleaner(t)

		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "test-ns"},
			Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance}},
		})
		pr.On("SetMessage", mock.Anything, mock.Anything).Return()
		pr.On("StrictMaxErrors", 1).Return()
		pr.On("ResetResults", false).Return()

		pr.On("Record", mock.Anything, mock.Anything).Return()

		exportWorker.On("Process", mock.Anything, repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Push != nil
		}), mock.Anything).Run(func(args mock.Arguments) {
			collector := args.Get(3).(jobs.JobProgressRecorder)
			ctx := args.Get(0).(context.Context)

			collector.Record(ctx, jobs.NewGVKResult("dash-ok", testGVK).
				WithAction(repository.FileActionCreated).Build())
			collector.Record(ctx, jobs.NewGVKResult("dash-fail", testGVK).
				WithAction(repository.FileActionIgnored).
				WithError(errors.New("export failed")).Build())
		}).Return(nil)

		syncWorker.On("Process", mock.MatchedBy(func(ctx context.Context) bool {
			al := resources.TakeoverAllowlistFromContext(ctx)
			if al == nil {
				return false
			}
			hasOk := al.Contains(resources.ResourceIdentifier{Name: "dash-ok", Group: "dashboard.grafana.app", Kind: "Dashboard"})
			hasFail := al.Contains(resources.ResourceIdentifier{Name: "dash-fail", Group: "dashboard.grafana.app", Kind: "Dashboard"})
			return hasOk && !hasFail
		}), repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil
		}), pr).Return(nil)

		nc.On("Clean", mock.Anything, "test-ns", pr).Return(nil)

		migrator := NewUnifiedStorageMigrator(nc, exportWorker, syncWorker)
		err := migrator.Migrate(context.Background(), repo, provisioning.MigrateJobOptions{}, pr)
		require.NoError(t, err)
	})
}

func TestUnifiedStorageMigrator_SelectiveResources(t *testing.T) {
	selected := []provisioning.ResourceRef{
		{Name: "dash-1", Kind: "Dashboard", Group: "dashboard.grafana.app"},
		{Name: "dash-2", Kind: "Dashboard", Group: "dashboard.grafana.app"},
	}

	t.Run("forwards Resources to the inner export job", func(t *testing.T) {
		exportWorker := jobs.NewMockWorker(t)
		syncWorker := jobs.NewMockWorker(t)
		pr := jobs.NewMockJobProgressRecorder(t)
		repo := repository.NewMockRepository(t)
		nc := NewMockNamespaceCleaner(t)

		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "test-ns"},
			Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder}},
		})
		pr.On("SetMessage", mock.Anything, mock.Anything).Return()
		pr.On("StrictMaxErrors", 1).Return()
		pr.On("ResetResults", false).Return()

		exportWorker.On("Process", mock.Anything, repo, mock.MatchedBy(func(job provisioning.Job) bool {
			if job.Spec.Push == nil {
				return false
			}
			if len(job.Spec.Push.Resources) != len(selected) {
				return false
			}
			for i := range selected {
				if job.Spec.Push.Resources[i] != selected[i] {
					return false
				}
			}
			return true
		}), mock.Anything).Return(nil)

		syncWorker.On("Process", mock.Anything, repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil
		}), pr).Return(nil)

		migrator := NewUnifiedStorageMigrator(nc, exportWorker, syncWorker)
		err := migrator.Migrate(context.Background(), repo, provisioning.MigrateJobOptions{Resources: selected}, pr)
		require.NoError(t, err)
	})

	t.Run("skips namespace cleanup when Resources is set on instance-target repos", func(t *testing.T) {
		exportWorker := jobs.NewMockWorker(t)
		syncWorker := jobs.NewMockWorker(t)
		pr := jobs.NewMockJobProgressRecorder(t)
		repo := repository.NewMockRepository(t)
		nc := NewMockNamespaceCleaner(t)

		repo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "test-ns"},
			Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance}},
		})
		pr.On("SetMessage", mock.Anything, mock.Anything).Return()
		pr.On("StrictMaxErrors", 1).Return()
		pr.On("ResetResults", false).Return()

		exportWorker.On("Process", mock.Anything, repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Push != nil
		}), mock.Anything).Return(nil)

		syncWorker.On("Process", mock.Anything, repo, mock.MatchedBy(func(job provisioning.Job) bool {
			return job.Spec.Pull != nil
		}), pr).Return(nil)

		// Cleaner.Clean must NOT be called for selective migrate; mockery would fail the
		// test if it were, since we never registered an expectation for it.

		migrator := NewUnifiedStorageMigrator(nc, exportWorker, syncWorker)
		err := migrator.Migrate(context.Background(), repo, provisioning.MigrateJobOptions{Resources: selected}, pr)
		require.NoError(t, err)
	})
}

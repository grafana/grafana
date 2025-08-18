package migrate

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/local"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func TestMigrationWorker_IsSupported(t *testing.T) {
	tests := []struct {
		name string
		job  provisioning.Job
		want bool
	}{
		{
			name: "should support migrate action",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionMigrate,
				},
			},
			want: true,
		},
		{
			name: "should not support other actions",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: "other",
				},
			},
			want: false,
		},
	}

	worker := NewMigrationWorker(nil, nil, nil)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := worker.IsSupported(context.Background(), tt.job)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestMigrationWorker_ProcessNotReaderWriter(t *testing.T) {
	worker := NewMigrationWorker(nil, nil, nil)
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action:  provisioning.JobActionMigrate,
			Migrate: &provisioning.MigrateJobOptions{},
		},
	}
	progressRecorder := jobs.NewMockJobProgressRecorder(t)
	progressRecorder.On("SetTotal", mock.Anything, 10).Return()

	repo := repository.NewMockReader(t)
	err := worker.Process(context.Background(), repo, job, progressRecorder)
	require.EqualError(t, err, "migration job submitted targeting repository that is not a ReaderWriter")
}

func TestMigrationWorker_WithHistory(t *testing.T) {
	fakeDualwrite := dualwrite.NewMockService(t)
	fakeDualwrite.On("ReadFromUnified", mock.Anything, mock.Anything).
		Maybe().Return(true, nil) // using unified storage

	worker := NewMigrationWorker(nil, nil, fakeDualwrite)
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMigrate,
			Migrate: &provisioning.MigrateJobOptions{
				History: true,
			},
		},
	}

	t.Run("fail local", func(t *testing.T) {
		progressRecorder := jobs.NewMockJobProgressRecorder(t)
		progressRecorder.On("SetTotal", mock.Anything, 10).Return()

		repo := local.NewLocal(&provisioning.Repository{}, nil)
		err := worker.Process(context.Background(), repo, job, progressRecorder)
		require.EqualError(t, err, "history is only supported for github repositories")
	})

	t.Run("fail unified", func(t *testing.T) {
		progressRecorder := jobs.NewMockJobProgressRecorder(t)
		progressRecorder.On("SetTotal", mock.Anything, 10).Return()

		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
				GitHub: &provisioning.GitHubRepositoryConfig{
					URL: "empty", // not valid
				},
			},
		})
		err := worker.Process(context.Background(), repo, job, progressRecorder)
		require.EqualError(t, err, "history is not yet supported in unified storage")
	})
}

func TestMigrationWorker_Process(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(*MockMigrator, *MockMigrator, *dualwrite.MockService, *jobs.MockJobProgressRecorder)
		setupRepo      func(*repository.MockRepository)
		job            provisioning.Job
		expectedError  string
		isLegacyActive bool
	}{
		{
			name: "should fail when migrate settings are missing",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: nil,
				},
			},
			setupMocks: func(lm *MockMigrator, um *MockMigrator, ds *dualwrite.MockService, pr *jobs.MockJobProgressRecorder) {
			},
			setupRepo: func(repo *repository.MockRepository) {
				// No Config() call expected since we fail before that
			},
			expectedError: "missing migrate settings",
		},
		{
			name: "should use legacy migrator when legacy storage is active",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			isLegacyActive: true,
			setupMocks: func(lm *MockMigrator, um *MockMigrator, ds *dualwrite.MockService, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(false, nil)
				lm.On("Migrate", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			setupRepo: func(repo *repository.MockRepository) {
				repo.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
			},
		},
		{
			name: "should use unified storage migrator when legacy storage is not active",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			isLegacyActive: false,
			setupMocks: func(lm *MockMigrator, um *MockMigrator, ds *dualwrite.MockService, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil)
				um.On("Migrate", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			setupRepo: func(repo *repository.MockRepository) {
				repo.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
			},
		},
		{
			name: "should propagate migrator errors",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			isLegacyActive: true,
			setupMocks: func(lm *MockMigrator, um *MockMigrator, ds *dualwrite.MockService, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(false, nil)
				lm.On("Migrate", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errors.New("migration failed"))
			},
			setupRepo: func(repo *repository.MockRepository) {
				repo.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
			},
			expectedError: "migration failed",
		},
		{
			name: "should block migration of legacy resources for folder-type repositories",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			isLegacyActive: true,
			setupMocks: func(lm *MockMigrator, um *MockMigrator, ds *dualwrite.MockService, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(false, nil)
				// legacyMigrator should not be called as we block before reaching it
			},
			setupRepo: func(repo *repository.MockRepository) {
				repo.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				})
			},
			expectedError: "migration of legacy resources is not supported for folder-type repositories",
		},
		{
			name: "should allow migration of legacy resources for instance-type repositories",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			isLegacyActive: true,
			setupMocks: func(lm *MockMigrator, um *MockMigrator, ds *dualwrite.MockService, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(false, nil)
				lm.On("Migrate", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			setupRepo: func(repo *repository.MockRepository) {
				repo.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeInstance,
						},
					},
				})
			},
			expectedError: "",
		},
		{
			name: "should allow migration for folder-type repositories when legacy storage is not active",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			isLegacyActive: false,
			setupMocks: func(lm *MockMigrator, um *MockMigrator, ds *dualwrite.MockService, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil)
				um.On("Migrate", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			setupRepo: func(repo *repository.MockRepository) {
				repo.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				})
			},
			expectedError: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			legacyMigrator := NewMockMigrator(t)
			unifiedMigrator := NewMockMigrator(t)
			dualWriteService := dualwrite.NewMockService(t)
			progressRecorder := jobs.NewMockJobProgressRecorder(t)

			worker := NewMigrationWorker(legacyMigrator, unifiedMigrator, dualWriteService)

			if tt.setupMocks != nil {
				tt.setupMocks(legacyMigrator, unifiedMigrator, dualWriteService, progressRecorder)
			}

			rw := repository.NewMockRepository(t)
			if tt.setupRepo != nil {
				tt.setupRepo(rw)
			}
			err := worker.Process(context.Background(), rw, tt.job, progressRecorder)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mock.AssertExpectationsForObjects(t, legacyMigrator, unifiedMigrator, dualWriteService, progressRecorder, rw)
		})
	}
}

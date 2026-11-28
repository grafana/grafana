package migrate

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagProvisioningExport)

	worker := NewMigrationWorker(nil, nil, nil)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := worker.IsSupported(t.Context(), tt.job)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestMigrationWorker_ProcessNotReaderWriter(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagProvisioningExport)

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
	repo.On("Config").Return(&provisioning.Repository{})
	err := worker.Process(t.Context(), repo, job, progressRecorder)
	require.EqualError(t, err, "migration job submitted targeting repository that is not a ReaderWriter")
}

func TestMigrationWorker_Process(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*jobs.MockWorker, *jobs.MockJobProgressRecorder)
		setupRepo     func(*repository.MockRepository)
		job           provisioning.Job
		expectedError string
	}{
		{
			name: "should fail when migrate settings are missing",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: nil,
				},
			},
			setupMocks: func(ew *jobs.MockWorker, pr *jobs.MockJobProgressRecorder) {
			},
			setupRepo: func(repo *repository.MockRepository) {
				// No Config() call expected since we fail before that
			},
			expectedError: "missing migrate settings",
		},
		{
			name: "should run the migration, starting with the export",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			setupMocks: func(ew *jobs.MockWorker, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errors.New("export failed"))
			},
			setupRepo: func(repo *repository.MockRepository) {
				repo.On("Config").Return(&provisioning.Repository{})
			},
			expectedError: "export resources: export failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exportWorker := jobs.NewMockWorker(t)
			progressRecorder := jobs.NewMockJobProgressRecorder(t)
			featuremgmt.WithEnabledFlags(t, featuremgmt.FlagProvisioningExport)

			worker := NewMigrationWorker(NewMockNamespaceCleaner(t), exportWorker, jobs.NewMockWorker(t))

			if tt.setupMocks != nil {
				tt.setupMocks(exportWorker, progressRecorder)
			}

			rw := repository.NewMockRepository(t)
			if tt.setupRepo != nil {
				tt.setupRepo(rw)
			}
			err := worker.Process(t.Context(), rw, tt.job, progressRecorder)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mock.AssertExpectationsForObjects(t, exportWorker, progressRecorder, rw)
		})
	}
}

// TestMigrationWorker_ConfigurationDisabled tests that migrate functionality is disabled when configuration flag is false
func TestMigrationWorker_ConfigurationDisabled(t *testing.T) {
	tests := []struct {
		name       string
		enabled    bool
		wantErr    bool
		wantErrMsg string
	}{
		{
			name:       "migrate job fails when feature flag is disabled",
			enabled:    false,
			wantErr:    true,
			wantErrMsg: "migrate functionality is disabled",
		},
		{
			name:    "migrate job proceeds when enabled",
			enabled: true,
			wantErr: false, // Will fail at later stage due to minimal mocks, but configuration check passes
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exportWorker := jobs.NewMockWorker(t)

			// Set up mock expectations for when enabled
			if tt.enabled {
				exportWorker.On("Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errors.New("export failed"))
				featuremgmt.WithEnabledFlags(t, featuremgmt.FlagProvisioningExport)
			}

			// Create migration worker
			worker := NewMigrationWorker(NewMockNamespaceCleaner(t), exportWorker, jobs.NewMockWorker(t))

			// Create a mock repository (ReaderWriter interface required)
			mockRepo := repository.NewMockReaderWriter(t)
			mockRepo.On("Config").Return(&provisioning.Repository{})

			// Create a test job
			job := provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-migrate-job",
					Namespace: "default",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Message: "Test migration",
					},
				},
			}

			// Create mock progress recorder
			progress := jobs.NewMockJobProgressRecorder(t)
			progress.On("SetTotal", mock.Anything, 10).Maybe()
			progress.On("SetMessage", mock.Anything, mock.Anything).Maybe()
			progress.On("StrictMaxErrors", 1).Maybe()

			// Process the job
			err := worker.Process(t.Context(), mockRepo, job, progress)

			// Verify results
			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErrMsg)
			} else {
				// When enabled, job proceeds past configuration check
				// It may fail later due to minimal mocks, but the configuration check passed
				if err != nil {
					// Job failed due to mocking, not configuration - that's okay
					assert.NotContains(t, err.Error(), "functionality is disabled")
				}
			}
		})
	}
}

package migrate

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
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

	worker := NewMigrationWorker(nil, true)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := worker.IsSupported(context.Background(), tt.job)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestMigrationWorker_ProcessNotReaderWriter(t *testing.T) {
	worker := NewMigrationWorker(NewMockMigrator(t), true)
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

func TestMigrationWorker_Process(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockMigrator, *jobs.MockJobProgressRecorder)
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
			setupMocks: func(um *MockMigrator, pr *jobs.MockJobProgressRecorder) {
			},
			setupRepo: func(repo *repository.MockRepository) {
				// No Config() call expected since we fail before that
			},
			expectedError: "missing migrate settings",
		},
		{
			name: "should use unified storage migrator for instance-type repositories",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			setupMocks: func(um *MockMigrator, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				um.On("Migrate", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			setupRepo: func(repo *repository.MockRepository) {
				// No Config() call needed anymore
			},
		},
		{
			name: "should allow migration for folder-type repositories",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:  provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{},
				},
			},
			setupMocks: func(um *MockMigrator, pr *jobs.MockJobProgressRecorder) {
				pr.On("SetTotal", mock.Anything, 10).Return()
				um.On("Migrate", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			setupRepo: func(repo *repository.MockRepository) {
				// No Config() call needed anymore
			},
			expectedError: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unifiedMigrator := NewMockMigrator(t)
			progressRecorder := jobs.NewMockJobProgressRecorder(t)

			worker := NewMigrationWorker(unifiedMigrator, true)

			if tt.setupMocks != nil {
				tt.setupMocks(unifiedMigrator, progressRecorder)
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

			mock.AssertExpectationsForObjects(t, unifiedMigrator, progressRecorder, rw)
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
			name:       "migrate job fails when disabled by configuration",
			enabled:    false,
			wantErr:    true,
			wantErrMsg: "migrate functionality is disabled by configuration",
		},
		{
			name:    "migrate job proceeds when enabled",
			enabled: true,
			wantErr: false, // Will fail at later stage due to minimal mocks, but configuration check passes
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock migrator
			mockMigrator := NewMockMigrator(t)

			// Set up mock expectations for when enabled
			if tt.enabled {
				mockMigrator.On("Migrate", context.Background(), mock.Anything, mock.Anything, mock.Anything).Return(nil)
			}

			// Create migration worker
			worker := NewMigrationWorker(mockMigrator, tt.enabled)

			// Create a mock repository (ReaderWriter interface required)
			mockRepo := repository.NewMockReaderWriter(t)

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
			progress.On("SetTotal", context.Background(), 10).Maybe()

			// Process the job
			err := worker.Process(context.Background(), mockRepo, job, progress)

			// Verify results
			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErrMsg)
			} else {
				// When enabled, job proceeds past configuration check
				// It may fail later due to minimal mocks, but the configuration check passed
				if err != nil {
					// Job failed due to mocking, not configuration - that's okay
					assert.NotContains(t, err.Error(), "disabled by configuration")
				}
			}
		})
	}
}

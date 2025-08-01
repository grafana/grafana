package migrate

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), pr).Return(errors.New("export failed"))
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
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), pr).Return(nil)
				pr.On("ResetResults").Return()
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
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				nc.On("Clean", mock.Anything, "test-namespace", pr).Return(errors.New("clean failed"))

				// Export and sync jobs succeed
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), pr).Return(nil)
				pr.On("ResetResults").Return()
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
				})
				pr.On("SetMessage", mock.Anything, "export resources").Return()
				pr.On("StrictMaxErrors", 1).Return()
				// Export job succeeds
				ew.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Push != nil
				}), pr).Return(nil)

				nc.On("Clean", mock.Anything, "test-namespace", pr).Return(nil)
				// Reset progress and sync job succeeds
				pr.On("ResetResults").Return()
				pr.On("SetMessage", mock.Anything, "pull resources").Return()
				sw.On("Process", mock.Anything, rw, mock.MatchedBy(func(job provisioning.Job) bool {
					return job.Spec.Pull != nil && !job.Spec.Pull.Incremental
				}), pr).Return(nil)

				pr.On("SetMessage", mock.Anything, "clean namespace").Return()
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

			err := migrator.Migrate(context.Background(), readerWriter, provisioning.MigrateJobOptions{}, progressRecorder)

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

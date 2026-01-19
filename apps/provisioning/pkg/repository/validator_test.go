package repository

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestValidateRepository(t *testing.T) {
	tests := []struct {
		name          string
		repository    *provisioning.Repository
		expectedErrs  int
		validateError func(t *testing.T, errors field.ErrorList)
	}{
		{
			name: "valid repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				}
			}(),
			expectedErrs: 0,
		},
		{
			name: "missing title",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.title: Required value")
			},
		},
		{
			name: "sync enabled without target",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							IntervalSeconds: 10,
						}},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.sync.target: Required value")
			},
		},
		{
			name: "sync interval too low",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							Target:          provisioning.SyncTargetTypeFolder,
							IntervalSeconds: 5,
						}},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.sync.intervalSeconds: Invalid value")
			},
		},
		{
			name: "reserved name",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "sql",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							Target:          provisioning.SyncTargetTypeFolder,
							IntervalSeconds: 10,
						}},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "metadata.name: Invalid value")
			},
		},
		{
			name: "mismatched local config",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Type:  provisioning.GitHubRepositoryType,
						Local: &provisioning.LocalRepositoryConfig{},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.local: Invalid value")
			},
		},
		{
			name: "mismatched github config",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.LocalRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.github: Invalid value")
			},
		},
		{
			name: "github enabled when image rendering is not allowed",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{GenerateDashboardPreviews: true},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.generateDashboardPreviews: Invalid value")
			},
		},
		{
			name: "mismatched git config",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Type:  provisioning.LocalRepositoryType,
						Git:   &provisioning.GitRepositoryConfig{},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.git: Invalid value")
			},
		},
		{
			name: "multiple validation errors",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "sql",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							IntervalSeconds: 5,
							Target:          provisioning.SyncTargetTypeInstance,
						},
					},
				}
			}(),
			expectedErrs: 3,
			// 1. reserved name
			// 2. sync interval too low
			// 3. sync target not supported
		},
		{
			name: "branch workflow for non-github repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.LocalRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.workflow: Invalid value: \"branch\": branch is only supported on git repositories")
			},
		},
		{
			name: "invalid workflow in the list",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.GitHubRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, "invalid"},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.workflow: Invalid value: \"invalid\": invalid workflow")
			},
		},
		{
			name: "mutual exclusive finalizers are set together",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{RemoveOrphanResourcesFinalizer, ReleaseOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.GitHubRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "cannot have both remove and release orphan resources finalizers")
			},
		},
		{
			name: "invalid finalizer in the list",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, "invalid-finalizer", RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.GitHubRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "unknown finalizer: invalid-finalizer")
			},
		},
	}

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()
	validator := NewValidator(10*time.Second, []provisioning.SyncTargetType{provisioning.SyncTargetTypeFolder}, false, mockFactory)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Tests validate new configurations, so always pass isCreate=true
			errors := validator.ValidateRepository(context.Background(), tt.repository, true)
			require.Len(t, errors, tt.expectedErrs)
			if tt.validateError != nil {
				tt.validateError(t, errors)
			}
		})
	}
}

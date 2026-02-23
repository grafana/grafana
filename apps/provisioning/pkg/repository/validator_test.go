package repository

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestValidator_Validate(t *testing.T) {
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
			name: "reserved name",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:       "sql",
						Finalizers: []string{CleanFinalizer},
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
						Name:       "sql",
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							IntervalSeconds: 5,
							Target:          "",
						},
					},
				}
			}(),
			expectedErrs: 2,
			// 1. reserved name
			// 2. Empty target
			// Note: "sync target not supported" is now checked in AdmissionValidator, not RepositoryValidator
		},
		{
			name: "branch workflow for non-github repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
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
		{
			name: "no finalizers on resource not marked for deletion",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{},
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
				require.Contains(t, errors.ToAggregate().Error(), "cannot have no finalizers set on resources not marked for deletion")
			},
		},
	}

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()
	validator := NewValidator(false, mockFactory)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Tests validate new configurations, so always pass isCreate=true
			errors := validator.Validate(context.Background(), tt.repository)
			require.Len(t, errors, tt.expectedErrs)
			if tt.validateError != nil {
				tt.validateError(t, errors)
			}
		})
	}
}

func newAdmissionValidatorTestAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.RepositoryResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestAdmissionValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		obj             runtime.Object
		old             runtime.Object
		operation       admission.Operation
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "valid repository passes validation",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.GitHubRepositoryType,
					Sync:  provisioning.SyncOptions{IntervalSeconds: 60},
				},
			},
			operation: admission.Create,
			wantErr:   false,
		},
		{
			name: "invalid repository fails validation",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					// Missing title
					Type: provisioning.GitHubRepositoryType,
				},
			},
			operation: admission.Create,
			wantErr:   true,
		},
		{
			name:    "returns nil for nil object",
			obj:     nil,
			wantErr: false,
		},
		{
			name: "returns error for non-repository object",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "expected repository configuration",
		},
		{
			name: "skips validation for DELETE operations",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.RepositorySpec{
					// Invalid - missing title
				},
			},
			operation: admission.Delete,
			wantErr:   false,
		},
		{
			name: "skips validation for objects being deleted",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
				Spec: provisioning.RepositorySpec{
					// Invalid - missing title
				},
			},
			operation: admission.Update,
			wantErr:   false,
		},
		{
			name: "forbids changing repository type on update",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.GitRepositoryType, // Changed from github
					Sync:  provisioning.SyncOptions{IntervalSeconds: 60},
				},
			},
			old: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.GitHubRepositoryType,
					Sync:  provisioning.SyncOptions{IntervalSeconds: 60},
				},
			},
			operation:       admission.Update,
			wantErr:         true,
			wantErrContains: "Changing repository type is not supported",
		},
		{
			name: "forbids changing sync target after sync",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.GitHubRepositoryType,
					Sync:  provisioning.SyncOptions{IntervalSeconds: 60, Target: provisioning.SyncTargetTypeInstance},
				},
			},
			old: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.GitHubRepositoryType,
					Sync:  provisioning.SyncOptions{IntervalSeconds: 60, Target: provisioning.SyncTargetTypeFolder},
				},
				Status: provisioning.RepositoryStatus{
					Stats: []provisioning.ResourceCount{{Resource: "Dashboard", Count: 1}},
				},
			},
			operation:       admission.Update,
			wantErr:         true,
			wantErrContains: "Changing sync target after running sync is not supported",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := NewMockFactory(t)
			mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

			validator := NewValidator(false, mockFactory)

			admissionValidator := NewAdmissionValidator(
				[]provisioning.SyncTargetType{
					provisioning.SyncTargetTypeFolder,
					provisioning.SyncTargetTypeInstance,
				},
				validator,
			)

			attr := newAdmissionValidatorTestAttributes(tt.obj, tt.old, tt.operation)

			err := admissionValidator.Validate(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					assert.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestAdmissionValidator_CopiesSecureValuesOnUpdate(t *testing.T) {
	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	validator := NewValidator(false, mockFactory)
	admissionValidator := NewAdmissionValidator(
		[]provisioning.SyncTargetType{provisioning.SyncTargetTypeFolder},
		validator,
	)

	oldRepo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.GitHubRepositoryType,
			Sync:  provisioning.SyncOptions{IntervalSeconds: 60},
		},
		Secure: provisioning.SecureValues{
			Token:         common.InlineSecureValue{Name: "old-token"},
			WebhookSecret: common.InlineSecureValue{Name: "old-secret"},
		},
	}

	newRepo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.GitHubRepositoryType,
			Sync:  provisioning.SyncOptions{IntervalSeconds: 60},
		},
		// No secure values set
	}

	attr := newAdmissionValidatorTestAttributes(newRepo, oldRepo, admission.Update)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.NoError(t, err)

	// Verify secure values were copied
	assert.Equal(t, "old-token", newRepo.Secure.Token.Name)
	assert.Equal(t, "old-secret", newRepo.Secure.WebhookSecret.Name)
}

// mockValidator implements Validator for testing
type mockValidator struct {
	called bool
	errors field.ErrorList
}

func (m *mockValidator) Validate(ctx context.Context, cfg *provisioning.Repository) field.ErrorList {
	m.called = true
	return m.errors
}

func TestAdmissionValidator_CallsMultipleValidators(t *testing.T) {
	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	baseValidator := NewValidator(false, mockFactory)
	additionalValidator := &mockValidator{}

	admissionValidator := NewAdmissionValidator(
		[]provisioning.SyncTargetType{provisioning.SyncTargetTypeFolder},
		baseValidator,
		additionalValidator,
	)

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.GitHubRepositoryType,
			Sync:  provisioning.SyncOptions{IntervalSeconds: 60},
		},
	}

	attr := newAdmissionValidatorTestAttributes(repo, nil, admission.Create)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.NoError(t, err)
	assert.True(t, additionalValidator.called, "additional validator should have been called")
}

func TestAdmissionValidator_ValidatorError(t *testing.T) {
	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	baseValidator := NewValidator(false, mockFactory)
	additionalValidator := &mockValidator{
		errors: field.ErrorList{field.Forbidden(field.NewPath("spec"), "duplicate repository")},
	}

	admissionValidator := NewAdmissionValidator(
		[]provisioning.SyncTargetType{provisioning.SyncTargetTypeFolder},
		baseValidator,
		additionalValidator,
	)

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.GitHubRepositoryType,
			Sync:  provisioning.SyncOptions{IntervalSeconds: 60},
		},
	}

	attr := newAdmissionValidatorTestAttributes(repo, nil, admission.Create)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate repository")
}

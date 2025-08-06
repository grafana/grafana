package repository

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestValidateRepository(t *testing.T) {
	tests := []struct {
		name          string
		repository    *MockRepository
		expectedErrs  int
		validateError func(t *testing.T, errors field.ErrorList)
	}{
		{
			name: "valid repository",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 0,
		},
		{
			name: "missing title",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.title: Required value")
			},
		},
		{
			name: "sync enabled without target",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							IntervalSeconds: 10,
						},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.sync.target: Required value")
			},
		},
		{
			name: "sync interval too low",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							Target:          "test",
							IntervalSeconds: 5,
						},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.sync.intervalSeconds: Invalid value")
			},
		},
		{
			name: "reserved name",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "sql",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "metadata.name: Invalid value")
			},
		},
		{
			name: "mismatched local config",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Type:  provisioning.GitHubRepositoryType,
						Local: &provisioning.LocalRepositoryConfig{},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.local: Invalid value")
			},
		},
		{
			name: "mismatched github config",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.LocalRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.github: Invalid value")
			},
		},
		{
			name: "mismatched git config",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Type:  provisioning.LocalRepositoryType,
						Git:   &provisioning.GitRepositoryConfig{},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.git: Invalid value")
			},
		},
		{
			name: "multiple validation errors",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "sql",
					},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{
							Enabled:         true,
							IntervalSeconds: 5,
						},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 4, // Updated from 3 to 4 to match actual errors:
			// 1. missing title
			// 2. sync target missing
			// 3. sync interval too low
			// 4. reserved name
		},
		{
			name: "branch workflow for non-github repository",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.LocalRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.workflow: Invalid value: \"branch\": branch is only supported on git repositories")
			},
		},
		{
			name: "invalid workflow in the list",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.GitHubRepositoryType,
						Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, "invalid"},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.workflow: Invalid value: \"invalid\": invalid workflow")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := ValidateRepository(tt.repository)
			require.Len(t, errors, tt.expectedErrs)
			if tt.validateError != nil {
				tt.validateError(t, errors)
			}
		})
	}
}

func TestTestRepository(t *testing.T) {
	tests := []struct {
		name          string
		repository    *MockRepository
		expectedCode  int
		expectedErrs  []provisioning.ErrorDetails
		expectedError error
	}{
		{
			name: "validation fails",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						// Missing required title
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				return m
			}(),
			expectedCode: http.StatusUnprocessableEntity,
			expectedErrs: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueRequired,
				Field:  "spec.title",
				Detail: "a repository title must be given",
			}},
		},
		{
			name: "test passes",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				m.On("Test", mock.Anything).Return(&provisioning.TestResults{
					Code:    http.StatusOK,
					Success: true,
				}, nil)
				return m
			}(),
			expectedCode: http.StatusOK,
			expectedErrs: nil,
		},
		{
			name: "test fails with error",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				m.On("Test", mock.Anything).Return(nil, fmt.Errorf("test error"))
				return m
			}(),
			expectedError: fmt.Errorf("test error"),
		},
		{
			name: "test fails with results",
			repository: func() *MockRepository {
				m := NewMockRepository(t)
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
				m.On("Validate").Return(field.ErrorList{})
				m.On("Test", mock.Anything).Return(&provisioning.TestResults{
					Code:    http.StatusBadRequest,
					Success: false,
					Errors: []provisioning.ErrorDetails{{
						Type:  metav1.CauseTypeFieldValueInvalid,
						Field: "spec.property",
					}},
				}, nil)
				return m
			}(),
			expectedCode: http.StatusBadRequest,
			expectedErrs: []provisioning.ErrorDetails{{
				Type:  metav1.CauseTypeFieldValueInvalid,
				Field: "spec.property",
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := TestRepository(context.Background(), tt.repository)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
				return
			}

			require.NoError(t, err)
			require.NotNil(t, results)
			require.Equal(t, tt.expectedCode, results.Code)

			if tt.expectedErrs != nil {
				require.Equal(t, tt.expectedErrs, results.Errors)
				require.False(t, results.Success)
			} else {
				require.True(t, results.Success)
				require.Empty(t, results.Errors)
			}
		})
	}
}

func TestTester_TestRepository(t *testing.T) {
	// Test that it properly delegates to TestRepository
	repository := NewMockRepository(t)
	repository.On("Config").Return(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
		},
	})
	repository.On("Validate").Return(field.ErrorList{})
	repository.On("Test", mock.Anything).Return(&provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil)

	results, err := TestRepository(context.Background(), repository)
	require.NoError(t, err)
	require.NotNil(t, results)
	require.Equal(t, http.StatusOK, results.Code)
	require.True(t, results.Success)
}

func TestFromFieldError(t *testing.T) {
	tests := []struct {
		name           string
		fieldError     *field.Error
		expectedCode   int
		expectedField  string
		expectedType   metav1.CauseType
		expectedDetail string
	}{
		{
			name: "required field error",
			fieldError: &field.Error{
				Type:   field.ErrorTypeRequired,
				Field:  "spec.title",
				Detail: "a repository title must be given",
			},
			expectedCode:   http.StatusBadRequest,
			expectedField:  "spec.title",
			expectedType:   metav1.CauseTypeFieldValueRequired,
			expectedDetail: "a repository title must be given",
		},
		{
			name: "invalid field error",
			fieldError: &field.Error{
				Type:   field.ErrorTypeInvalid,
				Field:  "spec.sync.intervalSeconds",
				Detail: "Interval must be at least 10 seconds",
			},
			expectedCode:   http.StatusBadRequest,
			expectedField:  "spec.sync.intervalSeconds",
			expectedType:   metav1.CauseTypeFieldValueInvalid,
			expectedDetail: "Interval must be at least 10 seconds",
		},
		{
			name: "not supported field error",
			fieldError: &field.Error{
				Type:   field.ErrorTypeNotSupported,
				Field:  "spec.workflow",
				Detail: "branch is only supported on git repositories",
			},
			expectedCode:   http.StatusBadRequest,
			expectedField:  "spec.workflow",
			expectedType:   metav1.CauseTypeFieldValueNotSupported,
			expectedDetail: "branch is only supported on git repositories",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FromFieldError(tt.fieldError)

			require.NotNil(t, result)
			require.Equal(t, tt.expectedCode, result.Code)
			require.False(t, result.Success)
			require.Len(t, result.Errors, 1)

			errorDetail := result.Errors[0]
			require.Equal(t, tt.expectedField, errorDetail.Field)
			require.Equal(t, tt.expectedType, errorDetail.Type)
			require.Equal(t, tt.expectedDetail, errorDetail.Detail)
		})
	}
}

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

func TestTester_Test_Cases(t *testing.T) {
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						// Missing required title
					},
				})
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
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
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
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

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()
	validator := NewValidator(true, mockFactory)
	// Use basic RepositoryValidator since Tester is used for health checks
	tester := NewTester(validator)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := tester.Test(context.Background(), tt.repository)

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

func TestTester_Test(t *testing.T) {
	repository := NewMockRepository(t)
	repository.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
		},
	})
	repository.On("Test", mock.Anything).Return(&provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil)

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()
	validator := NewValidator(true, mockFactory)
	// Use basic RepositoryValidator since Tester is used for health checks
	tester := NewTester(validator)
	results, err := tester.Test(context.Background(), repository)
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

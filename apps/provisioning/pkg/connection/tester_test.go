package connection

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

func TestTestConnection(t *testing.T) {
	tests := []struct {
		name          string
		connection    *provisioning.Connection
		setupFactory  func(t *testing.T) *MockFactory
		setupConn     func(t *testing.T) *MockConnection
		expectedCode  int
		expectedErrs  []provisioning.ErrorDetails
		expectedError error
	}{
		{
			name: "validation fails - missing github config",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					// Missing GitHub config
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{
					field.Required(field.NewPath("spec", "github"), "github info must be specified for GitHub connection"),
				})
				return m
			},
			expectedCode: http.StatusUnprocessableEntity,
			expectedErrs: []provisioning.ErrorDetails{{
				Type:     metav1.CauseTypeFieldValueRequired,
				Field:    "spec.github",
				Detail:   "github info must be specified for GitHub connection",
				BadValue: "",
			}},
		},
		{
			name: "validation fails - missing private key",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "454545",
					},
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{
					field.Required(field.NewPath("secure", "privateKey"), "privateKey must be specified for GitHub connection"),
				})
				return m
			},
			expectedCode: http.StatusUnprocessableEntity,
			expectedErrs: []provisioning.ErrorDetails{{
				Type:     metav1.CauseTypeFieldValueRequired,
				Field:    "secure.privateKey",
				Detail:   "privateKey must be specified for GitHub connection",
				BadValue: "",
			}},
		},
		{
			name: "build fails - invalid secrets",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "454545",
					},
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{})
				m.EXPECT().Build(mock.Anything, mock.Anything).Return(nil, fmt.Errorf("failed to decrypt private key"))
				return m
			},
			expectedCode: http.StatusInternalServerError,
			expectedErrs: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  "",
				Detail: "failed to decrypt private key",
			}},
		},
		{
			name: "test passes",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "454545",
					},
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{})
				mockConn := NewMockConnection(t)
				mockConn.EXPECT().Test(mock.Anything).Return(&provisioning.TestResults{
					Code:    http.StatusOK,
					Success: true,
				}, nil)
				m.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil)
				return m
			},
			expectedCode: http.StatusOK,
			expectedErrs: nil,
		},
		{
			name: "test fails with error",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "454545",
					},
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{})
				mockConn := NewMockConnection(t)
				mockConn.EXPECT().Test(mock.Anything).Return(nil, fmt.Errorf("github API unavailable"))
				m.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil)
				return m
			},
			expectedError: fmt.Errorf("github API unavailable"),
		},
		{
			name: "test fails with results - app ID mismatch",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "454545",
					},
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{})
				mockConn := NewMockConnection(t)
				mockConn.EXPECT().Test(mock.Anything).Return(&provisioning.TestResults{
					Code:    http.StatusBadRequest,
					Success: false,
					Errors: []provisioning.ErrorDetails{{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  "spec.github.appID",
						Detail: "appID mismatch",
					}},
				}, nil)
				m.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil)
				return m
			},
			expectedCode: http.StatusBadRequest,
			expectedErrs: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  "spec.github.appID",
				Detail: "appID mismatch",
			}},
		},
		{
			name: "test fails with results - API unavailable",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "454545",
					},
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{})
				mockConn := NewMockConnection(t)
				mockConn.EXPECT().Test(mock.Anything).Return(&provisioning.TestResults{
					Code:    http.StatusServiceUnavailable,
					Success: false,
					Errors: []provisioning.ErrorDetails{{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  "spec.token",
						Detail: "github is unavailable",
					}},
				}, nil)
				m.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil)
				return m
			},
			expectedCode: http.StatusServiceUnavailable,
			expectedErrs: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  "spec.token",
				Detail: "github is unavailable",
			}},
		},
		{
			name: "validation fails with multiple errors",
			connection: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:   provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						// Missing AppID and InstallationID
					},
				},
			},
			setupFactory: func(t *testing.T) *MockFactory {
				m := NewMockFactory(t)
				m.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{
					field.Required(field.NewPath("spec", "github", "appID"), "appID must be specified for GitHub connection"),
					field.Required(field.NewPath("spec", "github", "installationID"), "installationID must be specified for GitHub connection"),
				})
				return m
			},
			expectedCode: http.StatusUnprocessableEntity,
			expectedErrs: []provisioning.ErrorDetails{
				{
					Type:     metav1.CauseTypeFieldValueRequired,
					Field:    "spec.github.appID",
					Detail:   "appID must be specified for GitHub connection",
					BadValue: "",
				},
				{
					Type:     metav1.CauseTypeFieldValueRequired,
					Field:    "spec.github.installationID",
					Detail:   "installationID must be specified for GitHub connection",
					BadValue: "",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := tt.setupFactory(t)
			tester := NewSimpleConnectionTester(factory)
			results, err := tester.TestConnection(context.Background(), tt.connection)

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

func TestTester_TestConnection(t *testing.T) {
	connection := &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{
			Type: provisioning.GithubConnectionType,
			GitHub: &provisioning.GitHubConnectionConfig{
				AppID:          "123456",
				InstallationID: "454545",
			},
		},
	}

	factory := NewMockFactory(t)
	factory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{})
	mockConn := NewMockConnection(t)
	mockConn.EXPECT().Test(mock.Anything).Return(&provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil)
	factory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConn, nil)

	tester := NewSimpleConnectionTester(factory)
	results, err := tester.TestConnection(context.Background(), connection)
	require.NoError(t, err)
	require.NotNil(t, results)
	require.Equal(t, http.StatusOK, results.Code)
	require.True(t, results.Success)
	require.Empty(t, results.Errors)
}

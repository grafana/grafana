package connection

import (
	"context"
	"fmt"
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

func newValidatorTestAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return newValidatorTestAttributesWithDryRun(obj, old, op, false)
}

func newValidatorTestAttributesWithDryRun(obj, old runtime.Object, op admission.Operation, dryRun bool) admission.Attributes {
	name := "test"
	if obj != nil {
		if conn, ok := obj.(*provisioning.Connection); ok {
			name = conn.GetName()
		}
	}
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.ConnectionResourceInfo.GroupVersionKind(),
		"default",
		name,
		provisioning.ConnectionResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		dryRun,
		&user.DefaultInfo{},
	)
}

func TestNewAdmissionValidator(t *testing.T) {
	factory := NewMockFactory(t)
	v := NewAdmissionValidator(factory)
	require.NotNil(t, v)
	assert.Equal(t, factory, v.factory)
}

func TestAdmissionValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		obj             runtime.Object
		old             runtime.Object
		operation       admission.Operation
		factoryErrors   field.ErrorList
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "valid connection passes validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
				},
			},
			operation:     admission.Create,
			factoryErrors: field.ErrorList{},
			wantErr:       false,
		},
		{
			name: "connection without title fails validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
			},
			operation: admission.Create,
			factoryErrors: field.ErrorList{
				field.Required(field.NewPath("spec", "title"), "title is required"),
			},
			wantErr: true,
		},
		{
			name: "connection with empty title fails validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "",
					Type:  provisioning.GithubConnectionType,
				},
			},
			operation: admission.Create,
			factoryErrors: field.ErrorList{
				field.Required(field.NewPath("spec", "title"), "title is required"),
			},
			wantErr: true,
		},
		{
			name: "factory validation errors are returned",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
				},
			},
			operation: admission.Create,
			factoryErrors: field.ErrorList{
				field.Required(field.NewPath("spec", "github", "appId"), "appId is required"),
			},
			wantErr: true,
		},
		{
			name:    "returns nil for nil object",
			obj:     nil,
			wantErr: false,
		},
		{
			name: "returns error for non-connection object",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "expected connection configuration",
		},
		{
			name: "skips validation for DELETE operations",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
				},
			},
			operation: admission.Delete,
			wantErr:   false,
		},
		{
			name: "skips validation for objects being deleted",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
				},
			},
			operation: admission.Update,
			wantErr:   false,
		},
		{
			name: "copies secure values from old connection on update",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
				},
			},
			old: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{Name: "old-token"},
				},
			},
			operation:     admission.Update,
			factoryErrors: field.ErrorList{},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)

			// Set up mock for validation
			if tt.obj != nil {
				if conn, ok := tt.obj.(*provisioning.Connection); ok {
					// Skip mock setup if object is being deleted
					if conn.DeletionTimestamp == nil {
						factory.EXPECT().Validate(mock.Anything, mock.Anything).Return(tt.factoryErrors).Maybe()
					}
				}
			}

			v := NewAdmissionValidator(factory)
			attr := newValidatorTestAttributes(tt.obj, tt.old, tt.operation)

			err := v.Validate(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					assert.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)

			// Verify secure values were copied on update
			if tt.old != nil && tt.obj != nil {
				if newConn, ok := tt.obj.(*provisioning.Connection); ok {
					if oldConn, ok := tt.old.(*provisioning.Connection); ok {
						if !oldConn.Secure.Token.IsZero() && newConn.Secure.Token.IsZero() {
							t.Error("expected token to be copied from old connection")
						}
					}
				}
			}
		})
	}
}

func TestAdmissionValidator_CopiesSecureValuesOnUpdate(t *testing.T) {
	factory := NewMockFactory(t)
	factory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	v := NewAdmissionValidator(factory)

	oldConn := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec: provisioning.ConnectionSpec{
			Title: "Test Connection",
			Type:  provisioning.GithubConnectionType,
		},
		Secure: provisioning.ConnectionSecure{
			Token:        common.InlineSecureValue{Name: "old-token"},
			PrivateKey:   common.InlineSecureValue{Name: "old-key"},
			ClientSecret: common.InlineSecureValue{Name: "old-secret"},
		},
	}

	newConn := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec: provisioning.ConnectionSpec{
			Title: "Test Connection",
			Type:  provisioning.GithubConnectionType,
		},
		// No secure values set
	}

	attr := newValidatorTestAttributes(newConn, oldConn, admission.Update)

	err := v.Validate(context.Background(), attr, nil)
	require.NoError(t, err)

	// Verify all secure values were copied
	assert.Equal(t, "old-token", newConn.Secure.Token.Name)
	assert.Equal(t, "old-key", newConn.Secure.PrivateKey.Name)
	assert.Equal(t, "old-secret", newConn.Secure.ClientSecret.Name)
}

func TestAdmissionValidator_Validate_DryRun(t *testing.T) {
	tests := []struct {
		name            string
		obj             runtime.Object
		operation       admission.Operation
		dryRun          bool
		factoryErrors   field.ErrorList
		buildError      error
		testResults     *provisioning.TestResults
		testError       error
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "dryRun with valid connection passes runtime validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			operation:     admission.Create,
			dryRun:        true,
			factoryErrors: field.ErrorList{},
			testResults: &provisioning.TestResults{
				Success: true,
				Code:    200,
				Errors:  []provisioning.ErrorDetails{},
			},
			wantErr: false,
		},
		{
			name: "dryRun with invalid installation ID fails runtime validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "999",
					},
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			operation:     admission.Create,
			dryRun:        true,
			factoryErrors: field.ErrorList{},
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    400,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  "spec.installationID",
						Detail: "invalid installation ID: 999",
					},
				},
			},
			wantErr:         true,
			wantErrContains: "invalid installation ID",
		},
		{
			name: "dryRun with invalid app ID fails runtime validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "999",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			operation:     admission.Create,
			dryRun:        true,
			factoryErrors: field.ErrorList{},
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    400,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  "spec.appID",
						Detail: "appID mismatch: expected 999, got 123",
					},
				},
			},
			wantErr:         true,
			wantErrContains: "appID mismatch",
		},
		{
			name: "dryRun with build error fails validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
			},
			operation:       admission.Create,
			dryRun:          true,
			factoryErrors:   field.ErrorList{},
			buildError:      fmt.Errorf("failed to decrypt secrets"),
			wantErr:         true,
			wantErrContains: "failed to build connection",
		},
		{
			name: "dryRun skips runtime validation if structural validation fails",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
				},
			},
			operation: admission.Create,
			dryRun:    true,
			factoryErrors: field.ErrorList{
				field.Required(field.NewPath("spec", "github", "appId"), "appId is required"),
			},
			wantErr: true,
		},
		{
			name: "dryRun with bad value in error propagates bad value to field error",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
			},
			operation:     admission.Create,
			dryRun:        true,
			factoryErrors: field.ErrorList{},
			testResults: &provisioning.TestResults{
				Success: false,
				Code:    400,
				Errors: []provisioning.ErrorDetails{
					{
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    "spec.github.appID",
						Detail:   "appID mismatch",
						BadValue: "123",
					},
				},
			},
			wantErr:         true,
			wantErrContains: "appID mismatch",
		},
		{
			name: "non-dryRun does not run runtime validation",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Title: "Test Connection",
					Type:  provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
			},
			operation:     admission.Create,
			dryRun:        false,
			factoryErrors: field.ErrorList{},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)
			mockConnection := NewMockConnection(t)

			// Set up mock for structural validation
			if tt.obj != nil {
				if conn, ok := tt.obj.(*provisioning.Connection); ok {
					if conn.DeletionTimestamp == nil {
						factory.EXPECT().Validate(mock.Anything, mock.Anything).Return(tt.factoryErrors).Maybe()
					}
				}
			}

			// Set up mocks for runtime validation (only if dryRun and structural validation passes)
			if tt.dryRun && len(tt.factoryErrors) == 0 && tt.obj != nil {
				if conn, ok := tt.obj.(*provisioning.Connection); ok {
					if conn.DeletionTimestamp == nil {
						if tt.buildError != nil {
							factory.EXPECT().Build(mock.Anything, mock.Anything).Return(nil, tt.buildError).Once()
						} else {
							factory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockConnection, nil).Once()
							if tt.testError != nil {
								mockConnection.EXPECT().Test(mock.Anything).Return(nil, tt.testError).Once()
							} else if tt.testResults != nil {
								mockConnection.EXPECT().Test(mock.Anything).Return(tt.testResults, nil).Once()
							}
						}
					}
				}
			}

			v := NewAdmissionValidator(factory)
			attr := newValidatorTestAttributesWithDryRun(tt.obj, nil, tt.operation, tt.dryRun)

			err := v.Validate(context.Background(), attr, nil)

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

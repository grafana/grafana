package connection

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

func newValidatorTestAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.ConnectionResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.ConnectionResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
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
				Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
			},
			operation:     admission.Create,
			factoryErrors: field.ErrorList{},
			wantErr:       false,
		},
		{
			name: "factory validation errors are returned",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
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
			name: "skips validation for objects being deleted",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
				Spec: provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
			},
			operation: admission.Update,
			wantErr:   false,
		},
		{
			name: "copies secure values from old connection on update",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
			},
			old: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
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
		Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
		Secure: provisioning.ConnectionSecure{
			Token:        common.InlineSecureValue{Name: "old-token"},
			PrivateKey:   common.InlineSecureValue{Name: "old-key"},
			ClientSecret: common.InlineSecureValue{Name: "old-secret"},
		},
	}

	newConn := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
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

// mockDeleteValidator is a mock implementation of DeleteValidator for testing
type mockDeleteValidator struct {
	called    bool
	namespace string
	name      string
	errs      field.ErrorList
}

func (m *mockDeleteValidator) ValidateDelete(ctx context.Context, namespace, name string) field.ErrorList {
	m.called = true
	m.namespace = namespace
	m.name = name
	return m.errs
}

func newDeleteTestAttributes(name string) admission.Attributes {
	return admission.NewAttributesRecord(
		nil, // obj is nil for delete operations
		nil,
		provisioning.ConnectionResourceInfo.GroupVersionKind(),
		"default",
		name,
		provisioning.ConnectionResourceInfo.GroupVersionResource(),
		"",
		admission.Delete,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestAdmissionValidator_ValidateDelete(t *testing.T) {
	tests := []struct {
		name            string
		connectionName  string
		deleteValidator *mockDeleteValidator
		wantErr         bool
		wantCalled      bool
	}{
		{
			name:           "calls delete validators on delete operation",
			connectionName: "test-connection",
			deleteValidator: &mockDeleteValidator{
				errs: nil,
			},
			wantErr:    false,
			wantCalled: true,
		},
		{
			name:           "returns error from delete validator",
			connectionName: "test-connection",
			deleteValidator: &mockDeleteValidator{
				errs: field.ErrorList{
					field.Forbidden(field.NewPath("metadata", "name"), "cannot delete"),
				},
			},
			wantErr:    true,
			wantCalled: true,
		},
		{
			name:            "skips delete validation when name is empty",
			connectionName:  "",
			deleteValidator: &mockDeleteValidator{},
			wantErr:         false,
			wantCalled:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)
			v := NewAdmissionValidator(factory, tt.deleteValidator)

			attr := newDeleteTestAttributes(tt.connectionName)
			err := v.Validate(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, tt.wantCalled, tt.deleteValidator.called)
			if tt.wantCalled {
				assert.Equal(t, "default", tt.deleteValidator.namespace)
				assert.Equal(t, tt.connectionName, tt.deleteValidator.name)
			}
		})
	}
}

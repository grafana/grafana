package connection

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func newMutatorTestAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
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

func TestNewAdmissionMutator(t *testing.T) {
	factory := NewMockFactory(t)
	m := NewAdmissionMutator(factory)
	require.NotNil(t, m)
	assert.Equal(t, factory, m.factory)
}

func TestAdmissionMutator_Mutate(t *testing.T) {
	tests := []struct {
		name            string
		obj             runtime.Object
		factoryErr      error
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "calls factory mutate for connection",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
			},
			wantErr: false,
		},
		{
			name:            "returns error for non-connection object",
			obj:             &provisioning.Repository{},
			wantErr:         true,
			wantErrContains: "expected connection configuration",
		},
		{
			name:    "returns nil for nil object",
			obj:     nil,
			wantErr: false,
		},
		{
			name: "propagates factory mutate error",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
			},
			factoryErr:      errors.New("factory error"),
			wantErr:         true,
			wantErrContains: "factory error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)

			// Only set up mock if we expect it to be called
			if tt.obj != nil {
				if _, ok := tt.obj.(*provisioning.Connection); ok {
					factory.EXPECT().Mutate(mock.Anything, mock.Anything).Return(tt.factoryErr).Maybe()
				}
			}

			m := NewAdmissionMutator(factory)
			attr := newMutatorTestAttributes(tt.obj, nil, admission.Create)

			err := m.Mutate(context.Background(), attr, nil)

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

func TestCopySecureValues(t *testing.T) {
	tests := []struct {
		name             string
		new              *provisioning.Connection
		old              *provisioning.Connection
		wantPrivateKey   common.InlineSecureValue
		wantToken        common.InlineSecureValue
		wantClientSecret common.InlineSecureValue
	}{
		{
			name: "copies private key from old to new when new is zero",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{Name: "old-key"},
				},
			},
			wantPrivateKey: common.InlineSecureValue{Name: "old-key"},
		},
		{
			name: "copies token from old to new when new is zero",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{Name: "old-token"},
				},
			},
			wantToken: common.InlineSecureValue{Name: "old-token"},
		},
		{
			name: "copies client secret from old to new when new is zero",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{Name: "old-secret"},
				},
			},
			wantClientSecret: common.InlineSecureValue{Name: "old-secret"},
		},
		{
			name: "does not overwrite existing values in new",
			new: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey:   common.InlineSecureValue{Name: "new-key"},
					Token:        common.InlineSecureValue{Name: "new-token"},
					ClientSecret: common.InlineSecureValue{Name: "new-secret"},
				},
			},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey:   common.InlineSecureValue{Name: "old-key"},
					Token:        common.InlineSecureValue{Name: "old-token"},
					ClientSecret: common.InlineSecureValue{Name: "old-secret"},
				},
			},
			wantPrivateKey:   common.InlineSecureValue{Name: "new-key"},
			wantToken:        common.InlineSecureValue{Name: "new-token"},
			wantClientSecret: common.InlineSecureValue{Name: "new-secret"},
		},
		{
			name:           "handles nil old connection",
			new:            &provisioning.Connection{},
			old:            nil,
			wantPrivateKey: common.InlineSecureValue{},
		},
		{
			name:           "handles old connection with zero secure values",
			new:            &provisioning.Connection{},
			old:            &provisioning.Connection{},
			wantPrivateKey: common.InlineSecureValue{},
		},
		{
			name: "copies all values when all are zero in new",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey:   common.InlineSecureValue{Name: "old-key"},
					Token:        common.InlineSecureValue{Name: "old-token"},
					ClientSecret: common.InlineSecureValue{Name: "old-secret"},
				},
			},
			wantPrivateKey:   common.InlineSecureValue{Name: "old-key"},
			wantToken:        common.InlineSecureValue{Name: "old-token"},
			wantClientSecret: common.InlineSecureValue{Name: "old-secret"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			CopySecureValues(tt.new, tt.old)
			assert.Equal(t, tt.wantPrivateKey, tt.new.Secure.PrivateKey)
			assert.Equal(t, tt.wantToken, tt.new.Secure.Token)
			assert.Equal(t, tt.wantClientSecret, tt.new.Secure.ClientSecret)
		})
	}
}

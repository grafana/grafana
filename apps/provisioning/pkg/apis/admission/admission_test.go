package admission

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// mockMutator is a test implementation of Mutator
type mockMutator struct {
	called bool
	err    error
}

func (m *mockMutator) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	m.called = true
	return m.err
}

// mockValidator is a test implementation of Validator
type mockValidator struct {
	called bool
	err    error
}

func (v *mockValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	v.called = true
	return v.err
}


func newTestAttributes(obj runtime.Object, resource string, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		nil,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.SchemeGroupVersion.WithResource(resource),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestNewHandler(t *testing.T) {
	h := NewHandler()
	require.NotNil(t, h)
	assert.NotNil(t, h.mutators)
	assert.NotNil(t, h.validators)
	assert.Empty(t, h.mutators)
	assert.Empty(t, h.validators)
}

func TestHandler_RegisterMutator(t *testing.T) {
	h := NewHandler()
	m := &mockMutator{}

	h.RegisterMutator("repositories", m)

	assert.Len(t, h.mutators, 1)
	assert.Equal(t, m, h.mutators["repositories"])
}

func TestHandler_RegisterValidator(t *testing.T) {
	h := NewHandler()
	v := &mockValidator{}

	h.RegisterValidator("repositories", v)

	assert.Len(t, h.validators, 1)
	assert.Equal(t, v, h.validators["repositories"])
}


func TestHandler_Mutate(t *testing.T) {
	tests := []struct {
		name            string
		resource        string
		operation       admission.Operation
		obj             runtime.Object
		registerMutator bool
		mutatorErr      error
		wantCalled      bool
		wantErr         bool
	}{
		{
			name:            "calls registered mutator",
			resource:        "repositories",
			operation:       admission.Create,
			obj:             &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerMutator: true,
			wantCalled:      true,
			wantErr:         false,
		},
		{
			name:            "returns nil for unregistered resource",
			resource:        "unknown",
			operation:       admission.Create,
			obj:             &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerMutator: false,
			wantCalled:      false,
			wantErr:         false,
		},
		{
			name:            "returns nil for nil object",
			resource:        "repositories",
			operation:       admission.Create,
			obj:             nil,
			registerMutator: true,
			wantCalled:      false,
			wantErr:         false,
		},
		{
			name:            "returns nil for Connect operation",
			resource:        "repositories",
			operation:       admission.Connect,
			obj:             &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerMutator: true,
			wantCalled:      false,
			wantErr:         false,
		},
		{
			name:            "propagates mutator error",
			resource:        "repositories",
			operation:       admission.Create,
			obj:             &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerMutator: true,
			mutatorErr:      errors.New("mutation failed"),
			wantCalled:      true,
			wantErr:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewHandler()
			m := &mockMutator{err: tt.mutatorErr}

			if tt.registerMutator {
				h.RegisterMutator("repositories", m)
			}

			attr := newTestAttributes(tt.obj, tt.resource, tt.operation)
			err := h.Mutate(context.Background(), attr, nil)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.wantCalled, m.called)
		})
	}
}

func TestHandler_Validate(t *testing.T) {
	tests := []struct {
		name              string
		resource          string
		operation         admission.Operation
		obj               runtime.Object
		registerValidator bool
		validatorErr      error
		wantCalled        bool
		wantErr           bool
	}{
		{
			name:              "calls registered validator",
			resource:          "repositories",
			operation:         admission.Create,
			obj:               &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerValidator: true,
			wantCalled:        true,
			wantErr:           false,
		},
		{
			name:              "returns nil for unregistered resource",
			resource:          "unknown",
			operation:         admission.Create,
			obj:               &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerValidator: false,
			wantCalled:        false,
			wantErr:           false,
		},
		{
			name:              "returns nil for nil object",
			resource:          "repositories",
			operation:         admission.Create,
			obj:               nil,
			registerValidator: true,
			wantCalled:        false,
			wantErr:           false,
		},
		{
			name:              "returns nil for Connect operation",
			resource:          "repositories",
			operation:         admission.Connect,
			obj:               &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerValidator: true,
			wantCalled:        false,
			wantErr:           false,
		},
		{
			name:              "calls validator for Delete operation",
			resource:          "repositories",
			operation:         admission.Delete,
			obj:               nil, // obj is nil for delete operations
			registerValidator: true,
			wantCalled:        true,
			wantErr:           false,
		},
		{
			name:              "propagates validator error",
			resource:          "repositories",
			operation:         admission.Create,
			obj:               &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "test"}},
			registerValidator: true,
			validatorErr:      errors.New("validation failed"),
			wantCalled:        true,
			wantErr:           true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewHandler()
			v := &mockValidator{err: tt.validatorErr}

			if tt.registerValidator {
				h.RegisterValidator("repositories", v)
			}

			attr := newTestAttributes(tt.obj, tt.resource, tt.operation)
			err := h.Validate(context.Background(), attr, nil)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.wantCalled, v.called)
		})
	}
}

func TestHandler_MultipleResources(t *testing.T) {
	h := NewHandler()

	repoMutator := &mockMutator{}
	connMutator := &mockMutator{}
	repoValidator := &mockValidator{}
	connValidator := &mockValidator{}

	h.RegisterMutator("repositories", repoMutator)
	h.RegisterMutator("connections", connMutator)
	h.RegisterValidator("repositories", repoValidator)
	h.RegisterValidator("connections", connValidator)

	// Test repository mutation
	repoAttr := newTestAttributes(&provisioning.Repository{}, "repositories", admission.Create)
	err := h.Mutate(context.Background(), repoAttr, nil)
	assert.NoError(t, err)
	assert.True(t, repoMutator.called)
	assert.False(t, connMutator.called)

	// Reset
	repoMutator.called = false

	// Test connection mutation
	connAttr := newTestAttributes(&provisioning.Connection{}, "connections", admission.Create)
	err = h.Mutate(context.Background(), connAttr, nil)
	assert.NoError(t, err)
	assert.False(t, repoMutator.called)
	assert.True(t, connMutator.called)
}

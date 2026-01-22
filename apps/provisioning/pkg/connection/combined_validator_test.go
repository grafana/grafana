package connection

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// mockAdmissionValidator is a mock implementation of appadmission.Validator for testing
type mockAdmissionValidator struct {
	called bool
	err    error
}

func (m *mockAdmissionValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	m.called = true
	return m.err
}

func newTestAttributes(name string, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		nil,
		nil,
		provisioning.ConnectionResourceInfo.GroupVersionKind(),
		"default",
		name,
		provisioning.ConnectionResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestCombinedValidator(t *testing.T) {
	t.Run("calls all validators in order", func(t *testing.T) {
		v1 := &mockAdmissionValidator{}
		v2 := &mockAdmissionValidator{}
		combined := NewCombinedValidator(v1, v2)

		attr := newTestAttributes("test", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.NoError(t, err)
		assert.True(t, v1.called)
		assert.True(t, v2.called)
	})

	t.Run("stops on first error", func(t *testing.T) {
		expectedErr := errors.New("first error")
		v1 := &mockAdmissionValidator{err: expectedErr}
		v2 := &mockAdmissionValidator{}
		combined := NewCombinedValidator(v1, v2)

		attr := newTestAttributes("test", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.True(t, v1.called)
		assert.False(t, v2.called, "second validator should not be called when first fails")
	})

	t.Run("returns nil when no validators", func(t *testing.T) {
		combined := NewCombinedValidator()

		attr := newTestAttributes("test", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.NoError(t, err)
	})

	t.Run("handles single validator", func(t *testing.T) {
		v1 := &mockAdmissionValidator{}
		combined := NewCombinedValidator(v1)

		attr := newTestAttributes("test", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.NoError(t, err)
		assert.True(t, v1.called)
	})
}

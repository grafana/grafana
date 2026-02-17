package admission

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/admission"
)

func TestCombinedValidator(t *testing.T) {
	t.Run("calls all validators in order", func(t *testing.T) {
		v1 := &mockValidator{}
		v2 := &mockValidator{}
		combined := NewCombinedValidator(v1, v2)

		attr := newTestAttributes(nil, "connections", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.NoError(t, err)
		assert.True(t, v1.called)
		assert.True(t, v2.called)
	})

	t.Run("stops on first error", func(t *testing.T) {
		expectedErr := errors.New("first error")
		v1 := &mockValidator{err: expectedErr}
		v2 := &mockValidator{}
		combined := NewCombinedValidator(v1, v2)

		attr := newTestAttributes(nil, "connections", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.True(t, v1.called)
		assert.False(t, v2.called, "second validator should not be called when first fails")
	})

	t.Run("returns nil when no validators", func(t *testing.T) {
		combined := NewCombinedValidator()

		attr := newTestAttributes(nil, "connections", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.NoError(t, err)
	})

	t.Run("handles single validator", func(t *testing.T) {
		v1 := &mockValidator{}
		combined := NewCombinedValidator(v1)

		attr := newTestAttributes(nil, "connections", admission.Create)
		err := combined.Validate(context.Background(), attr, nil)

		require.NoError(t, err)
		assert.True(t, v1.called)
	})
}

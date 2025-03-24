package assert

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTrue(t *testing.T) {
	t.Parallel()

	require.PanicsWithValue(t, "error msg", func() {
		True(1 == 2, "error msg")
	})

	require.PanicsWithValue(t, "error msg 1", func() {
		True(1 == 2, "error msg %d", 1)
	})

	require.NotPanics(t, func() {
		True(true, "oops")
	})
}

func TestErrorIs(t *testing.T) {
	t.Parallel()

	err := errors.New("some error")

	require.PanicsWithValue(t, "expected error *errors.errorString(other error) to be *errors.errorString(some error)", func() {
		ErrorIs(fmt.Errorf("other error"), err)
	})

	require.NotPanics(t, func() {
		ErrorIs(err, err)
		ErrorIs(fmt.Errorf("something: %w", err), err)
	})
}

func TestEqual(t *testing.T) {
	t.Parallel()

	require.PanicsWithValue(t, "expected 1 to equal 2: details", func() {
		Equal(1, 2, "details")
	})

	require.NotPanics(t, func() {
		Equal("a", "a", "details")
	})
}

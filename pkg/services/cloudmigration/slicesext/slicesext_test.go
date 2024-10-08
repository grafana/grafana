package slicesext_test

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/cloudmigration/slicesext"
)

func TestMap(t *testing.T) {
	t.Parallel()

	t.Run("mapping a nil slice does nothing and returns an empty slice", func(t *testing.T) {
		t.Parallel()

		require.Empty(t, slicesext.Map[any, any](nil, nil))
	})

	t.Run("mapping a non-nil slice with a nil function panics", func(t *testing.T) {
		t.Parallel()

		require.Panics(t, func() { slicesext.Map[int, any]([]int{1, 2, 3}, nil) })
	})

	t.Run("mapping a non-nil slice with a non-nil function returns the mapped slice", func(t *testing.T) {
		t.Parallel()

		original := []int{1, 2, 3}
		expected := []string{"1", "2", "3"}
		fn := func(i int) string { return strconv.Itoa(i) }

		require.ElementsMatch(t, expected, slicesext.Map(original, fn))
	})
}

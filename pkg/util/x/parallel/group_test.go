package parallel

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/require"
)

func TestGroup(t *testing.T) {
	g := NewGroup[rune](context.Background(), GroupOpts[rune]{})
	const characters = "abcdef"

	for _, c := range characters {
		c := c
		err := g.Go(func(ctx context.Context) (rune, error) {
			return c, nil
		})
		require.NoError(t, err)
	}

	results, err := g.Wait()
	require.NoError(t, err)

	sb := strings.Builder{}
	for _, res := range results {
		require.NoError(t, res.Error)
		sb.WriteRune(res.Value)
	}
	assert.Equal(t, characters, sb.String())
}

func TestGroup_Cancel(t *testing.T) {
	g := NewGroup[int](context.Background(), GroupOpts[int]{})
	ch := make(chan struct{})

	for i := 0; i < 32; i++ {
		i := i
		err := g.Go(func(ctx context.Context) (int, error) {
			select {
			case <-ch:
				return i, nil
			case <-ctx.Done():
				return 0, ctx.Err()
			}
		})
		require.NoError(t, err)
	}

	g.Cancel()

	results, err := g.Wait()
	require.NoError(t, err)

	for _, res := range results {
		require.ErrorIs(t, res.Error, context.Canceled)
		assert.Empty(t, res.Value)
	}
}

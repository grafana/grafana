package otel

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
)

func TestContextAttributes(t *testing.T) {
	t.Parallel()

	// test context. Note that it's perfectly safe to use context.Background()
	// and there is no risk of the test blocking at any point because we will
	// not use the deadline or signal cancellation features of the context
	ctx := context.Background()

	// test attributes
	attr1 := attribute.String("the key", "the value")
	attr2 := attribute.String("the other key", "the other value")
	attr3 := attribute.String("why not", "have another value")
	attr4 := attribute.String("it's free", "don't worry")

	// the subtests are not Parallel because we define this test as a storyline,
	// since we are interested in testing state changes in the context

	t.Run("consumeAttributes returns nil if SetAttributes was never called",
		func(t *testing.T) {
			attrs := consumeAttributes(ctx)
			require.Nil(t, attrs)
		})

	t.Run("setting and getting attributes", func(t *testing.T) {
		ctx = SetAttributes(ctx, attr1, attr2)
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 2)
		require.Equal(t, attr1, attrs[0])
		require.Equal(t, attr2, attrs[1])
	})

	t.Run("attributes are now cleared", func(t *testing.T) {
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 0)
	})

	t.Run("SetAttributes overwrites previous attributes", func(t *testing.T) {
		ctx = SetAttributes(context.Background(), attr1, attr2)
		ctx = SetAttributes(context.Background(), attr3, attr4)
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 2)
		require.Equal(t, attr3, attrs[0])
		require.Equal(t, attr4, attrs[1])
	})

	t.Run("attributes are now cleared again", func(t *testing.T) {
		attrs := consumeAttributes(ctx)
		require.Len(t, attrs, 0)
	})
}

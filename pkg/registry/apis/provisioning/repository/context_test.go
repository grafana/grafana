package repository

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestAuthorSignature(t *testing.T) {
	t.Run("should store and retrieve author signature", func(t *testing.T) {
		expected := CommitSignature{
			Name:  "John Doe",
			Email: "john@example.com",
			When:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		}

		ctx := context.Background()
		ctx = WithAuthorSignature(ctx, expected)

		result := GetAuthorSignature(ctx)
		require.NotNil(t, result)
		require.Equal(t, expected.Name, result.Name)
		require.Equal(t, expected.Email, result.Email)
		require.Equal(t, expected.When, result.When)
	})

	t.Run("should return nil when no signature is set", func(t *testing.T) {
		ctx := context.Background()
		result := GetAuthorSignature(ctx)
		require.Nil(t, result)
	})

	t.Run("should return copy of signature", func(t *testing.T) {
		original := CommitSignature{
			Name:  "John Doe",
			Email: "john@example.com",
			When:  time.Now(),
		}

		ctx := context.Background()
		ctx = WithAuthorSignature(ctx, original)

		result1 := GetAuthorSignature(ctx)
		result2 := GetAuthorSignature(ctx)

		require.NotNil(t, result1)
		require.NotNil(t, result2)
		require.NotSame(t, result1, result2)
	})
}

package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestIDTokenExtractor(t *testing.T) {
	t.Run("should return an error when no claims found", func(t *testing.T) {
		token, err := idTokenExtractor(context.Background())
		assert.Error(t, err)
		assert.Empty(t, token)
	})
	t.Run("should return an empty token when grafana identity is set", func(t *testing.T) {
		ctx, _ := identity.WithServiceIdentity(context.Background(), 0)
		token, err := idTokenExtractor(ctx)
		assert.NoError(t, err)
		assert.Empty(t, token)
	})
}

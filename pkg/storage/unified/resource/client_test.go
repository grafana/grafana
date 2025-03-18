package resource

import (
	"context"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
)

func TestIDTokenExtractor(t *testing.T) {
	t.Run("should return an error when no claims found", func(t *testing.T) {
		token, err := idTokenExtractor(context.Background())
		assert.Error(t, err)
		assert.Empty(t, token)
	})
	t.Run("should return an empty token for static requester of type service account as grafana admin ", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:           claims.TypeServiceAccount,
			IsGrafanaAdmin: true,
		})
		token, err := idTokenExtractor(ctx)
		assert.NoError(t, err)
		assert.Empty(t, token)
	})
}

package resource

import (
	"context"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
)

func TestIDTokenExtractorInternal(t *testing.T) {
	t.Run("should return empty when no claims found", func(t *testing.T) {
		ctx := context.Background()
		token, err := idTokenExtractorInternal(ctx)
		assert.NoError(t, err)
		assert.Empty(t, token)
	})

	t.Run("should create internal token for StaticRequester", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:           claims.TypeServiceAccount,
			UserID:         1,
			OrgID:          1,
			Name:           "foo",
			Login:          "foo",
			OrgRole:        identity.RoleAdmin,
			IsGrafanaAdmin: false,
		})
		token, err := idTokenExtractorInternal(ctx)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)
	})
}

func TestIDTokenExtractorCloud(t *testing.T) {
	t.Run("should return an empty string when no claims found", func(t *testing.T) {
		token, err := idTokenExtractorCloud(context.Background())
		assert.NoError(t, err)
		assert.Empty(t, token)
	})
	t.Run("should return an error for StaticRequester", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:           claims.TypeServiceAccount,
			UserID:         1,
			OrgID:          1,
			Name:           "foo",
			Login:          "foo",
			OrgRole:        identity.RoleAdmin,
			IsGrafanaAdmin: false,
		})
		_, err := idTokenExtractorCloud(ctx)
		assert.Error(t, err)
	})
}

package resource

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource/access"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIDTokenExtractorInternal(t *testing.T) {
	t.Run("should return internal token when running as Grafana", func(t *testing.T) {
		ctx := access.RunAsGrafana(context.Background())
		token, err := idTokenExtractorInternal(ctx)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)
		parsed, err := jwt.ParseSigned(token)
		t.Log(parsed)
		require.NoError(t, err)
		require.NotNil(t, parsed)
	})

	t.Run("should return error when no claims found", func(t *testing.T) {
		ctx := context.Background()
		token, err := idTokenExtractorInternal(ctx)
		assert.Error(t, err)
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
	t.Run("should return an empty string when running as Grafana", func(t *testing.T) {
		ctx := access.RunAsGrafana(context.Background())
		token, err := idTokenExtractorCloud(ctx)
		assert.NoError(t, err)
		assert.Empty(t, token)
	})

	t.Run("should return error when no claims found", func(t *testing.T) {
		ctx := context.Background()
		token, err := idTokenExtractorCloud(ctx)
		assert.Error(t, err)
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

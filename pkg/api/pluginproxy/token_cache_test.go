package pluginproxy

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeCredential struct {
	key                string
	calledTimes        int
	getAccessTokenFunc func(ctx context.Context, scopes []string) (*AccessToken, error)
}

func (c *fakeCredential) GetCacheKey() string {
	return c.key
}

func (c *fakeCredential) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	c.calledTimes = c.calledTimes + 1
	if c.getAccessTokenFunc != nil {
		return c.getAccessTokenFunc(ctx, scopes)
	}
	fakeAccessToken := &AccessToken{Token: fmt.Sprintf("%v-token-%v", c.key, c.calledTimes), ExpiresOn: timeNow().Add(time.Hour)}
	return fakeAccessToken, nil
}

func TestConcurrentTokenCache_GetAccessToken(t *testing.T) {
	ctx := context.Background()

	scopes1 := []string{"Scope1"}
	scopes2 := []string{"Scope2"}

	t.Run("should request access token from credential", func(t *testing.T) {
		cache := NewConcurrentTokenCache()
		credential := &fakeCredential{key: "credential-1"}

		token, err := cache.GetAccessToken(ctx, credential, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "credential-1-token-1", token)

		assert.Equal(t, 1, credential.calledTimes)
	})

	t.Run("should return cached token for same scopes", func(t *testing.T) {
		var token1, token2 string
		var err error

		cache := NewConcurrentTokenCache()
		credential := &fakeCredential{key: "credential-1"}

		token1, err = cache.GetAccessToken(ctx, credential, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "credential-1-token-1", token1)

		token2, err = cache.GetAccessToken(ctx, credential, scopes2)
		require.NoError(t, err)
		assert.Equal(t, "credential-1-token-2", token2)

		token1, err = cache.GetAccessToken(ctx, credential, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "credential-1-token-1", token1)

		token2, err = cache.GetAccessToken(ctx, credential, scopes2)
		require.NoError(t, err)
		assert.Equal(t, "credential-1-token-2", token2)

		assert.Equal(t, 2, credential.calledTimes)
	})

	t.Run("should return cached token for same credentials", func(t *testing.T) {
		var token1, token2 string
		var err error

		cache := NewConcurrentTokenCache()
		credential1 := &fakeCredential{key: "credential-1"}
		credential2 := &fakeCredential{key: "credential-2"}

		token1, err = cache.GetAccessToken(ctx, credential1, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "credential-1-token-1", token1)

		token2, err = cache.GetAccessToken(ctx, credential2, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "credential-2-token-1", token2)

		token1, err = cache.GetAccessToken(ctx, credential1, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "credential-1-token-1", token1)

		token2, err = cache.GetAccessToken(ctx, credential2, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "credential-2-token-1", token2)

		assert.Equal(t, 1, credential1.calledTimes)
		assert.Equal(t, 1, credential2.calledTimes)
	})
}

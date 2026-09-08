package v2

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type memoryCache struct {
	mutex  sync.Mutex
	values map[string][]byte
}

func (c *memoryCache) Get(_ context.Context, key string) ([]byte, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	value, found := c.values[key]
	if !found {
		return nil, errors.New("not found")
	}
	return bytes.Clone(value), nil
}

func (c *memoryCache) Set(_ context.Context, key string, value []byte, _ time.Duration) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.values[key] = bytes.Clone(value)
	return nil
}

func (c *memoryCache) Delete(_ context.Context, key string) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	delete(c.values, key)
	return nil
}

func TestAccessTokenAuthenticator(t *testing.T) {
	authenticator := NewAccessTokenAuthenticator()

	t.Run("parses one access token into header authorization", func(t *testing.T) {
		request := authorizationRequest{
			headers: http.Header{"X-Access-Token": {"Bearer access-token"}},
		}
		authorization, err := authenticator.Authorize(context.Background(), request)
		require.NoError(t, err)

		query := url.Values{}
		headers := http.Header{}
		authorization.apply(query, headers)

		require.Equal(t, "Bearer access-token", headers.Get(AccessTokenHeader))
		require.False(t, query.Has(renderKeyQueryParameter))
	})

	for _, test := range []struct {
		name    string
		headers http.Header
	}{
		{name: "missing", headers: http.Header{}},
		{name: "empty", headers: http.Header{"X-Access-Token": {" "}}},
		{name: "ambiguous", headers: http.Header{"X-Access-Token": {"one", "two"}}},
	} {
		t.Run("rejects "+test.name+" access token", func(t *testing.T) {
			_, err := authenticator.Authorize(context.Background(), authorizationRequest{headers: test.headers})
			require.ErrorIs(t, err, ErrAccessTokenInvalid)
		})
	}
}

func TestJWTRenderKeyAuthenticator(t *testing.T) {
	authenticator := NewJWTRenderKeyAuthenticator()
	request := authorizationRequest{
		identity: renderIdentity{orgID: 1, userID: 2, orgRole: "Viewer"},
		secret:   rendererAuthToken{value: "renderer-token"},
		lifetime: renderKeyLifetime{duration: time.Minute},
	}

	authorization, err := authenticator.Authorize(context.Background(), request)
	require.NoError(t, err)
	query := url.Values{}
	authorization.apply(query, http.Header{})

	key := query.Get(renderKeyQueryParameter)
	require.NotEmpty(t, key)
	user, found := authenticator.Authenticate(context.Background(), renderKey{value: key}, request.authenticationConfiguration())
	require.True(t, found)
	require.Equal(t, RenderUser{OrgID: 1, UserID: 2, OrgRole: "Viewer"}, user)
}

func TestCachedRenderKeyAuthenticator(t *testing.T) {
	cache := &memoryCache{values: map[string][]byte{}}
	authenticator, err := NewCachedRenderKeyAuthenticator(cache)
	require.NoError(t, err)
	request := authorizationRequest{
		identity: renderIdentity{orgID: 1, userID: 2, orgRole: "Viewer"},
		lifetime: renderKeyLifetime{duration: time.Minute},
	}

	authorization, err := authenticator.Authorize(context.Background(), request)
	require.NoError(t, err)
	query := url.Values{}
	authorization.apply(query, http.Header{})
	key, err := ParseRenderKey(query.Get(renderKeyQueryParameter))
	require.NoError(t, err)

	user, found := authenticator.Authenticate(context.Background(), key, request.authenticationConfiguration())
	require.True(t, found)
	require.Equal(t, RenderUser{OrgID: 1, UserID: 2, OrgRole: "Viewer"}, user)

	type legacyRenderUser struct {
		OrgID   int64
		UserID  int64
		OrgRole string
	}
	encoded := cache.values[fmt.Sprintf(renderKeyCachePrefix, key.value)]
	var legacyUser legacyRenderUser
	require.NoError(t, gob.NewDecoder(bytes.NewReader(encoded)).Decode(&legacyUser))
	require.Equal(t, legacyRenderUser{OrgID: 1, UserID: 2, OrgRole: "Viewer"}, legacyUser)

	var legacyEncoded bytes.Buffer
	require.NoError(t, gob.NewEncoder(&legacyEncoded).Encode(&legacyRenderUser{OrgID: 3, UserID: 4, OrgRole: "Editor"}))
	require.NoError(t, cache.Set(context.Background(), fmt.Sprintf(renderKeyCachePrefix, "legacy-key"), legacyEncoded.Bytes(), time.Minute))
	legacyKey, err := ParseRenderKey("legacy-key")
	require.NoError(t, err)
	user, found = authenticator.Authenticate(context.Background(), legacyKey, request.authenticationConfiguration())
	require.True(t, found)
	require.Equal(t, RenderUser{OrgID: 3, UserID: 4, OrgRole: "Editor"}, user)

	authorization.close(context.Background())
	_, found = authenticator.Authenticate(context.Background(), key, request.authenticationConfiguration())
	require.False(t, found)
}

package aztokenprovider

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeRetriever struct {
	key                string
	initCalledTimes    int
	calledTimes        int
	initFunc           func() error
	getAccessTokenFunc func(ctx context.Context, scopes []string) (*AccessToken, error)
}

func (c *fakeRetriever) GetCacheKey() string {
	return c.key
}

func (c *fakeRetriever) Reset() {
	c.initCalledTimes = 0
	c.calledTimes = 0
}

func (c *fakeRetriever) Init() error {
	c.initCalledTimes = c.initCalledTimes + 1
	if c.initFunc != nil {
		return c.initFunc()
	}
	return nil
}

func (c *fakeRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
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

	t.Run("should request access token from retriever", func(t *testing.T) {
		cache := NewConcurrentTokenCache()
		tokenRetriever := &fakeRetriever{key: "retriever"}

		token, err := cache.GetAccessToken(ctx, tokenRetriever, scopes1)
		require.NoError(t, err)
		assert.Equal(t, "retriever-token-1", token)

		assert.Equal(t, 1, tokenRetriever.calledTimes)
	})

	t.Run("should return cached token for same scopes", func(t *testing.T) {
		var token1, token2 string
		var err error

		cache := NewConcurrentTokenCache()
		credential := &fakeRetriever{key: "credential-1"}

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
		credential1 := &fakeRetriever{key: "credential-1"}
		credential2 := &fakeRetriever{key: "credential-2"}

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

func TestCredentialCacheEntry_EnsureInitialized(t *testing.T) {
	t.Run("when retriever init returns error", func(t *testing.T) {
		tokenRetriever := &fakeRetriever{
			initFunc: func() error {
				return errors.New("unable to initialize")
			},
		}

		t.Run("should return error", func(t *testing.T) {
			cacheEntry := &credentialCacheEntry{
				retriever: tokenRetriever,
			}

			err := cacheEntry.ensureInitialized()

			assert.Error(t, err)
		})

		t.Run("should call init again each time and return error", func(t *testing.T) {
			tokenRetriever.Reset()

			cacheEntry := &credentialCacheEntry{
				retriever: tokenRetriever,
			}

			var err error
			err = cacheEntry.ensureInitialized()
			assert.Error(t, err)

			err = cacheEntry.ensureInitialized()
			assert.Error(t, err)

			err = cacheEntry.ensureInitialized()
			assert.Error(t, err)

			assert.Equal(t, 3, tokenRetriever.initCalledTimes)
		})
	})

	t.Run("when retriever init returns error only once", func(t *testing.T) {
		var times = 0
		tokenRetriever := &fakeRetriever{
			initFunc: func() error {
				times = times + 1
				if times == 1 {
					return errors.New("unable to initialize")
				}
				return nil
			},
		}

		t.Run("should call retriever init again only while it returns error", func(t *testing.T) {
			cacheEntry := &credentialCacheEntry{
				retriever: tokenRetriever,
			}

			var err error
			err = cacheEntry.ensureInitialized()
			assert.Error(t, err)

			err = cacheEntry.ensureInitialized()
			assert.NoError(t, err)

			err = cacheEntry.ensureInitialized()
			assert.NoError(t, err)

			assert.Equal(t, 2, tokenRetriever.initCalledTimes)
		})
	})

	t.Run("when retriever init panics", func(t *testing.T) {
		tokenRetriever := &fakeRetriever{
			initFunc: func() error {
				panic(errors.New("unable to initialize"))
			},
		}

		t.Run("should call retriever init again each time", func(t *testing.T) {
			tokenRetriever.Reset()

			cacheEntry := &credentialCacheEntry{
				retriever: tokenRetriever,
			}

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_ = cacheEntry.ensureInitialized()
			}()

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_ = cacheEntry.ensureInitialized()
			}()

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_ = cacheEntry.ensureInitialized()
			}()

			assert.Equal(t, 3, tokenRetriever.initCalledTimes)
		})
	})

	t.Run("when retriever init panics only once", func(t *testing.T) {
		var times = 0
		tokenRetriever := &fakeRetriever{
			initFunc: func() error {
				times = times + 1
				if times == 1 {
					panic(errors.New("unable to initialize"))
				}
				return nil
			},
		}

		t.Run("should call retriever init again only while it panics", func(t *testing.T) {
			cacheEntry := &credentialCacheEntry{
				retriever: tokenRetriever,
			}

			var err error

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_ = cacheEntry.ensureInitialized()
			}()

			func() {
				defer func() {
					assert.Nil(t, recover(), "retriever not expected to panic")
				}()
				err = cacheEntry.ensureInitialized()
				assert.NoError(t, err)
			}()

			func() {
				defer func() {
					assert.Nil(t, recover(), "retriever not expected to panic")
				}()
				err = cacheEntry.ensureInitialized()
				assert.NoError(t, err)
			}()

			assert.Equal(t, 2, tokenRetriever.initCalledTimes)
		})
	})
}

func TestScopesCacheEntry_GetAccessToken(t *testing.T) {
	ctx := context.Background()

	scopes := []string{"Scope1"}

	t.Run("when retriever getAccessToken returns error", func(t *testing.T) {
		tokenRetriever := &fakeRetriever{
			getAccessTokenFunc: func(ctx context.Context, scopes []string) (*AccessToken, error) {
				invalidToken := &AccessToken{Token: "invalid_token", ExpiresOn: timeNow().Add(time.Hour)}
				return invalidToken, errors.New("unable to get access token")
			},
		}

		t.Run("should return error", func(t *testing.T) {
			cacheEntry := &scopesCacheEntry{
				retriever: tokenRetriever,
				scopes:    scopes,
				cond:      sync.NewCond(&sync.Mutex{}),
			}

			accessToken, err := cacheEntry.getAccessToken(ctx)

			assert.Error(t, err)
			assert.Equal(t, "", accessToken)
		})

		t.Run("should call retriever again each time and return error", func(t *testing.T) {
			tokenRetriever.Reset()

			cacheEntry := &scopesCacheEntry{
				retriever: tokenRetriever,
				scopes:    scopes,
				cond:      sync.NewCond(&sync.Mutex{}),
			}

			var err error
			_, err = cacheEntry.getAccessToken(ctx)
			assert.Error(t, err)

			_, err = cacheEntry.getAccessToken(ctx)
			assert.Error(t, err)

			_, err = cacheEntry.getAccessToken(ctx)
			assert.Error(t, err)

			assert.Equal(t, 3, tokenRetriever.calledTimes)
		})
	})

	t.Run("when retriever getAccessToken returns error only once", func(t *testing.T) {
		var times = 0
		retriever := &fakeRetriever{
			getAccessTokenFunc: func(ctx context.Context, scopes []string) (*AccessToken, error) {
				times = times + 1
				if times == 1 {
					invalidToken := &AccessToken{Token: "invalid_token", ExpiresOn: timeNow().Add(time.Hour)}
					return invalidToken, errors.New("unable to get access token")
				}
				fakeAccessToken := &AccessToken{Token: fmt.Sprintf("token-%v", times), ExpiresOn: timeNow().Add(time.Hour)}
				return fakeAccessToken, nil
			},
		}

		t.Run("should call retriever again only while it returns error", func(t *testing.T) {
			cacheEntry := &scopesCacheEntry{
				retriever: retriever,
				scopes:    scopes,
				cond:      sync.NewCond(&sync.Mutex{}),
			}

			var accessToken string
			var err error

			_, err = cacheEntry.getAccessToken(ctx)
			assert.Error(t, err)

			accessToken, err = cacheEntry.getAccessToken(ctx)
			assert.NoError(t, err)
			assert.Equal(t, "token-2", accessToken)

			accessToken, err = cacheEntry.getAccessToken(ctx)
			assert.NoError(t, err)
			assert.Equal(t, "token-2", accessToken)

			assert.Equal(t, 2, retriever.calledTimes)
		})
	})

	t.Run("when retriever getAccessToken panics", func(t *testing.T) {
		tokenRetriever := &fakeRetriever{
			getAccessTokenFunc: func(ctx context.Context, scopes []string) (*AccessToken, error) {
				panic(errors.New("unable to get access token"))
			},
		}

		t.Run("should call retriever again each time", func(t *testing.T) {
			tokenRetriever.Reset()

			cacheEntry := &scopesCacheEntry{
				retriever: tokenRetriever,
				scopes:    scopes,
				cond:      sync.NewCond(&sync.Mutex{}),
			}

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_, _ = cacheEntry.getAccessToken(ctx)
			}()

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_, _ = cacheEntry.getAccessToken(ctx)
			}()

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_, _ = cacheEntry.getAccessToken(ctx)
			}()

			assert.Equal(t, 3, tokenRetriever.calledTimes)
		})
	})

	t.Run("when retriever getAccessToken panics only once", func(t *testing.T) {
		var times = 0
		tokenRetriever := &fakeRetriever{
			getAccessTokenFunc: func(ctx context.Context, scopes []string) (*AccessToken, error) {
				times = times + 1
				if times == 1 {
					panic(errors.New("unable to get access token"))
				}
				fakeAccessToken := &AccessToken{Token: fmt.Sprintf("token-%v", times), ExpiresOn: timeNow().Add(time.Hour)}
				return fakeAccessToken, nil
			},
		}

		t.Run("should call retriever again only while it panics", func(t *testing.T) {
			cacheEntry := &scopesCacheEntry{
				retriever: tokenRetriever,
				scopes:    scopes,
				cond:      sync.NewCond(&sync.Mutex{}),
			}

			var accessToken string
			var err error

			func() {
				defer func() {
					assert.NotNil(t, recover(), "retriever expected to panic")
				}()
				_, _ = cacheEntry.getAccessToken(ctx)
			}()

			func() {
				defer func() {
					assert.Nil(t, recover(), "retriever not expected to panic")
				}()
				accessToken, err = cacheEntry.getAccessToken(ctx)
				assert.NoError(t, err)
				assert.Equal(t, "token-2", accessToken)
			}()

			func() {
				defer func() {
					assert.Nil(t, recover(), "retriever not expected to panic")
				}()
				accessToken, err = cacheEntry.getAccessToken(ctx)
				assert.NoError(t, err)
				assert.Equal(t, "token-2", accessToken)
			}()

			assert.Equal(t, 2, tokenRetriever.calledTimes)
		})
	})
}

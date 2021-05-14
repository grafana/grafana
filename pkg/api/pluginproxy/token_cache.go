package pluginproxy

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"
)

type AccessToken struct {
	Token     string
	ExpiresOn time.Time
}

type TokenCredential interface {
	GetCacheKey() string
	GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error)
}

type ConcurrentTokenCache interface {
	GetAccessToken(ctx context.Context, credential TokenCredential, scopes []string) (string, error)
}

func NewConcurrentTokenCache() ConcurrentTokenCache {
	return &tokenCacheImpl{}
}

type tokenCacheImpl struct {
	cache sync.Map // of *credentialCacheEntry
}
type credentialCacheEntry struct {
	credential TokenCredential
	cache      sync.Map // of *scopesCacheEntry
}

type scopesCacheEntry struct {
	credential TokenCredential
	scopes     []string

	cond        *sync.Cond
	refreshing  bool
	accessToken *AccessToken
}

func (c *tokenCacheImpl) GetAccessToken(ctx context.Context, credential TokenCredential, scopes []string) (string, error) {
	var entry interface{}
	var ok bool

	credentialKey := credential.GetCacheKey()
	scopesKey := getKeyForScopes(scopes)

	if entry, ok = c.cache.Load(credentialKey); !ok {
		entry, _ = c.cache.LoadOrStore(credentialKey, &credentialCacheEntry{
			credential: credential,
		})
	}

	credentialEntry := entry.(*credentialCacheEntry)

	if entry, ok = credentialEntry.cache.Load(scopesKey); !ok {
		entry, _ = credentialEntry.cache.LoadOrStore(scopesKey, &scopesCacheEntry{
			credential: credentialEntry.credential,
			scopes:     scopes,
			cond:       sync.NewCond(&sync.Mutex{}),
		})
	}

	scopesEntry := entry.(*scopesCacheEntry)

	return scopesEntry.getAccessToken(ctx)
}

func (c *scopesCacheEntry) getAccessToken(ctx context.Context) (string, error) {
	var accessToken *AccessToken
	var err error
	shouldRefresh := false

	c.cond.L.Lock()
	for {
		if c.accessToken != nil && c.accessToken.ExpiresOn.After(time.Now().Add(2*time.Minute)) {
			// Use the cached token since it's available and not expired yet
			accessToken = c.accessToken
			break
		}

		if !c.refreshing {
			// Start refreshing the token
			c.refreshing = true
			shouldRefresh = true
			break
		}

		// Wait for the token to be refreshed
		c.cond.Wait()
	}
	c.cond.L.Unlock()

	if shouldRefresh {
		accessToken, err = c.credential.GetAccessToken(ctx, c.scopes)

		c.cond.L.Lock()

		c.refreshing = false
		c.accessToken = accessToken

		c.cond.Broadcast()
		c.cond.L.Unlock()

		if err != nil {
			return "", err
		}
	}

	return accessToken.Token, nil
}

func getKeyForScopes(scopes []string) string {
	if len(scopes) > 1 {
		arr := make([]string, len(scopes))
		copy(arr, scopes)
		sort.Strings(arr)
		scopes = arr
	}

	return strings.Join(scopes, " ")
}

// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build appenginevm !appengine

package google

import (
	"strings"
	"sync"
	"time"

	"github.com/golang/oauth2"
	"google.golang.org/appengine"
	"google.golang.org/appengine/memcache"
)

var (
	// memcacheGob enables mocking of the memcache.Gob calls for unit testing.
	memcacheGob memcacher = &aeMemcache{}

	// accessTokenFunc enables mocking of the appengine.AccessToken call for unit testing.
	accessTokenFunc = appengine.AccessToken

	// mu protects multiple threads from attempting to fetch a token at the same time.
	mu sync.Mutex

	// tokens implements a local cache of tokens to prevent hitting quota limits for appengine.AccessToken calls.
	tokens map[string]*oauth2.Token
)

// safetyMargin is used to avoid clock-skew problems.
// 5 minutes is conservative because tokens are valid for 60 minutes.
const safetyMargin = 5 * time.Minute

func init() {
	tokens = make(map[string]*oauth2.Token)
}

// AppEngineContext requires an App Engine request context.
func AppEngineContext(ctx appengine.Context) oauth2.Option {
	return func(opts *oauth2.Options) error {
		opts.TokenFetcherFunc = makeAppEngineTokenFetcher(ctx, opts)
		return nil
	}
}

// FetchToken fetches a new access token for the provided scopes.
// Tokens are cached locally and also with Memcache so that the app can scale
// without hitting quota limits by calling appengine.AccessToken too frequently.
func makeAppEngineTokenFetcher(ctx appengine.Context, opts *oauth2.Options) func(*oauth2.Token) (*oauth2.Token, error) {
	return func(existing *oauth2.Token) (*oauth2.Token, error) {
		mu.Lock()
		defer mu.Unlock()

		key := ":" + strings.Join(opts.Scopes, "_")
		now := time.Now().Add(safetyMargin)
		if t, ok := tokens[key]; ok && !t.Expiry.Before(now) {
			return t, nil
		}
		delete(tokens, key)

		// Attempt to get token from Memcache
		tok := new(oauth2.Token)
		_, err := memcacheGob.Get(ctx, key, tok)
		if err == nil && !tok.Expiry.Before(now) {
			tokens[key] = tok // Save token locally
			return tok, nil
		}

		token, expiry, err := accessTokenFunc(ctx, opts.Scopes...)
		if err != nil {
			return nil, err
		}
		t := &oauth2.Token{
			AccessToken: token,
			Expiry:      expiry,
		}
		tokens[key] = t
		// Also back up token in Memcache
		if err = memcacheGob.Set(ctx, &memcache.Item{
			Key:        key,
			Value:      []byte{},
			Object:     *t,
			Expiration: expiry.Sub(now),
		}); err != nil {
			ctx.Errorf("unexpected memcache.Set error: %v", err)
		}
		return t, nil
	}
}

// aeMemcache wraps the needed Memcache functionality to make it easy to mock
type aeMemcache struct{}

func (m *aeMemcache) Get(c appengine.Context, key string, tok *oauth2.Token) (*memcache.Item, error) {
	return memcache.Gob.Get(c, key, tok)
}

func (m *aeMemcache) Set(c appengine.Context, item *memcache.Item) error {
	return memcache.Gob.Set(c, item)
}

type memcacher interface {
	Get(c appengine.Context, key string, tok *oauth2.Token) (*memcache.Item, error)
	Set(c appengine.Context, item *memcache.Item) error
}

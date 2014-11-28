// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build appengine,!appenginevm

package google

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/golang/oauth2"

	"appengine"
	"appengine/memcache"
)

type tokMap map[string]*oauth2.Token

type mockMemcache struct {
	mu                 sync.RWMutex
	vals               tokMap
	getCount, setCount int
}

func (m *mockMemcache) Get(c appengine.Context, key string, tok *oauth2.Token) (*memcache.Item, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.getCount++
	v, ok := m.vals[key]
	if !ok {
		return nil, fmt.Errorf("unexpected test error: key %q not found", key)
	}
	*tok = *v
	return nil, nil // memcache.Item is ignored anyway - return nil
}

func (m *mockMemcache) Set(c appengine.Context, item *memcache.Item) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.setCount++
	tok, ok := item.Object.(oauth2.Token)
	if !ok {
		log.Fatalf("unexpected test error: item.Object is not an oauth2.Token: %#v", item)
	}
	m.vals[item.Key] = &tok
	return nil
}

var accessTokenCount = 0

func mockAccessToken(c appengine.Context, scopes ...string) (token string, expiry time.Time, err error) {
	accessTokenCount++
	return "mytoken", time.Now(), nil
}

const (
	testScope    = "myscope"
	testScopeKey = ":" + testScope
)

func init() {
	accessTokenFunc = mockAccessToken
}

func TestFetchTokenLocalCacheMiss(t *testing.T) {
	m := &mockMemcache{vals: make(tokMap)}
	memcacheGob = m
	accessTokenCount = 0
	delete(tokens, testScopeKey) // clear local cache
	f, err := oauth2.New(
		AppEngineContext(nil),
		oauth2.Scope(testScope),
	)
	if err != nil {
		t.Error(err)
	}
	tr := f.NewTransport()
	c := http.Client{Transport: tr}
	c.Get("server")
	if w := 1; m.getCount != w {
		t.Errorf("bad memcache.Get count: got %v, want %v", m.getCount, w)
	}
	if w := 1; accessTokenCount != w {
		t.Errorf("bad AccessToken count: got %v, want %v", accessTokenCount, w)
	}
	if w := 1; m.setCount != w {
		t.Errorf("bad memcache.Set count: got %v, want %v", m.setCount, w)
	}
	// Make sure local cache has been populated
	_, ok := tokens[testScopeKey]
	if !ok {
		t.Errorf("local cache not populated!")
	}
}

func TestFetchTokenLocalCacheHit(t *testing.T) {
	m := &mockMemcache{vals: make(tokMap)}
	memcacheGob = m
	accessTokenCount = 0
	// Pre-populate the local cache
	tokens[testScopeKey] = &oauth2.Token{
		AccessToken: "mytoken",
		Expiry:      time.Now().Add(1 * time.Hour),
	}
	f, err := oauth2.New(
		AppEngineContext(nil),
		oauth2.Scope(testScope),
	)
	if err != nil {
		t.Error(err)
	}
	tr := f.NewTransport()
	c := http.Client{Transport: tr}
	c.Get("server")
	if err != nil {
		t.Errorf("unable to FetchToken: %v", err)
	}
	if w := 0; m.getCount != w {
		t.Errorf("bad memcache.Get count: got %v, want %v", m.getCount, w)
	}
	if w := 0; accessTokenCount != w {
		t.Errorf("bad AccessToken count: got %v, want %v", accessTokenCount, w)
	}
	if w := 0; m.setCount != w {
		t.Errorf("bad memcache.Set count: got %v, want %v", m.setCount, w)
	}
	// Make sure local cache remains populated
	_, ok := tokens[testScopeKey]
	if !ok {
		t.Errorf("local cache not populated!")
	}
}

func TestFetchTokenMemcacheHit(t *testing.T) {
	m := &mockMemcache{vals: make(tokMap)}
	memcacheGob = m
	accessTokenCount = 0
	delete(tokens, testScopeKey) // clear local cache
	// Pre-populate the memcache
	tok := &oauth2.Token{
		AccessToken: "mytoken",
		Expiry:      time.Now().Add(1 * time.Hour),
	}
	m.Set(nil, &memcache.Item{
		Key:        testScopeKey,
		Object:     *tok,
		Expiration: 1 * time.Hour,
	})
	m.setCount = 0

	f, err := oauth2.New(
		AppEngineContext(nil),
		oauth2.Scope(testScope),
	)
	if err != nil {
		t.Error(err)
	}
	c := http.Client{Transport: f.NewTransport()}
	c.Get("server")
	if w := 1; m.getCount != w {
		t.Errorf("bad memcache.Get count: got %v, want %v", m.getCount, w)
	}
	if w := 0; accessTokenCount != w {
		t.Errorf("bad AccessToken count: got %v, want %v", accessTokenCount, w)
	}
	if w := 0; m.setCount != w {
		t.Errorf("bad memcache.Set count: got %v, want %v", m.setCount, w)
	}
	// Make sure local cache has been populated
	_, ok := tokens[testScopeKey]
	if !ok {
		t.Errorf("local cache not populated!")
	}
}

func TestFetchTokenLocalCacheExpired(t *testing.T) {
	m := &mockMemcache{vals: make(tokMap)}
	memcacheGob = m
	accessTokenCount = 0
	// Pre-populate the local cache
	tokens[testScopeKey] = &oauth2.Token{
		AccessToken: "mytoken",
		Expiry:      time.Now().Add(-1 * time.Hour),
	}
	// Pre-populate the memcache
	tok := &oauth2.Token{
		AccessToken: "mytoken",
		Expiry:      time.Now().Add(1 * time.Hour),
	}
	m.Set(nil, &memcache.Item{
		Key:        testScopeKey,
		Object:     *tok,
		Expiration: 1 * time.Hour,
	})
	m.setCount = 0
	f, err := oauth2.New(
		AppEngineContext(nil),
		oauth2.Scope(testScope),
	)
	if err != nil {
		t.Error(err)
	}
	c := http.Client{Transport: f.NewTransport()}
	c.Get("server")
	if w := 1; m.getCount != w {
		t.Errorf("bad memcache.Get count: got %v, want %v", m.getCount, w)
	}
	if w := 0; accessTokenCount != w {
		t.Errorf("bad AccessToken count: got %v, want %v", accessTokenCount, w)
	}
	if w := 0; m.setCount != w {
		t.Errorf("bad memcache.Set count: got %v, want %v", m.setCount, w)
	}
	// Make sure local cache remains populated
	_, ok := tokens[testScopeKey]
	if !ok {
		t.Errorf("local cache not populated!")
	}
}

func TestFetchTokenMemcacheExpired(t *testing.T) {
	m := &mockMemcache{vals: make(tokMap)}
	memcacheGob = m
	accessTokenCount = 0
	delete(tokens, testScopeKey) // clear local cache
	// Pre-populate the memcache
	tok := &oauth2.Token{
		AccessToken: "mytoken",
		Expiry:      time.Now().Add(-1 * time.Hour),
	}
	m.Set(nil, &memcache.Item{
		Key:        testScopeKey,
		Object:     *tok,
		Expiration: -1 * time.Hour,
	})
	m.setCount = 0
	f, err := oauth2.New(
		AppEngineContext(nil),
		oauth2.Scope(testScope),
	)
	if err != nil {
		t.Error(err)
	}
	c := http.Client{Transport: f.NewTransport()}
	c.Get("server")
	if w := 1; m.getCount != w {
		t.Errorf("bad memcache.Get count: got %v, want %v", m.getCount, w)
	}
	if w := 1; accessTokenCount != w {
		t.Errorf("bad AccessToken count: got %v, want %v", accessTokenCount, w)
	}
	if w := 1; m.setCount != w {
		t.Errorf("bad memcache.Set count: got %v, want %v", m.setCount, w)
	}
	// Make sure local cache has been populated
	_, ok := tokens[testScopeKey]
	if !ok {
		t.Errorf("local cache not populated!")
	}
}

// Copyright 2013 Beego Authors
// Copyright 2014 The Macaron Authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package session

import (
	"fmt"
	"strings"
	"sync"

	"github.com/bradfitz/gomemcache/memcache"

	"github.com/go-macaron/session"
)

// MemcacheStore represents a memcache session store implementation.
type MemcacheStore struct {
	c      *memcache.Client
	sid    string
	expire int32
	lock   sync.RWMutex
	data   map[interface{}]interface{}
}

// NewMemcacheStore creates and returns a memcache session store.
func NewMemcacheStore(c *memcache.Client, sid string, expire int32, kv map[interface{}]interface{}) *MemcacheStore {
	return &MemcacheStore{
		c:      c,
		sid:    sid,
		expire: expire,
		data:   kv,
	}
}

func NewItem(sid string, data []byte, expire int32) *memcache.Item {
	return &memcache.Item{
		Key:        sid,
		Value:      data,
		Expiration: expire,
	}
}

// Set sets value to given key in session.
func (s *MemcacheStore) Set(key, val interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = val
	return nil
}

// Get gets value by given key in session.
func (s *MemcacheStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *MemcacheStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *MemcacheStore) ID() string {
	return s.sid
}

// Release releases resource and save data to provider.
func (s *MemcacheStore) Release() error {
	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}

	return s.c.Set(NewItem(s.sid, data, s.expire))
}

// Flush deletes all session data.
func (s *MemcacheStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// MemcacheProvider represents a memcache session provider implementation.
type MemcacheProvider struct {
	c      *memcache.Client
	expire int32
}

// Init initializes memcache session provider.
// connStrs: 127.0.0.1:9090;127.0.0.1:9091
func (p *MemcacheProvider) Init(expire int64, connStrs string) error {
	p.expire = int32(expire)
	p.c = memcache.New(strings.Split(connStrs, ";")...)
	return nil
}

// Read returns raw session store by session ID.
func (p *MemcacheProvider) Read(sid string) (session.RawStore, error) {
	if !p.Exist(sid) {
		if err := p.c.Set(NewItem(sid, []byte(""), p.expire)); err != nil {
			return nil, err
		}
	}

	var kv map[interface{}]interface{}
	item, err := p.c.Get(sid)
	if err != nil {
		return nil, err
	}
	if len(item.Value) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(item.Value)
		if err != nil {
			return nil, err
		}
	}

	return NewMemcacheStore(p.c, sid, p.expire, kv), nil
}

// Exist returns true if session with given ID exists.
func (p *MemcacheProvider) Exist(sid string) bool {
	_, err := p.c.Get(sid)
	return err == nil
}

// Destory deletes a session by session ID.
func (p *MemcacheProvider) Destory(sid string) error {
	return p.c.Delete(sid)
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *MemcacheProvider) Regenerate(oldsid, sid string) (_ session.RawStore, err error) {
	if p.Exist(sid) {
		return nil, fmt.Errorf("new sid '%s' already exists", sid)
	}

	item := NewItem(sid, []byte(""), p.expire)
	if p.Exist(oldsid) {
		item, err = p.c.Get(oldsid)
		if err != nil {
			return nil, err
		} else if err = p.c.Delete(oldsid); err != nil {
			return nil, err
		}
		item.Key = sid
	}
	if err = p.c.Set(item); err != nil {
		return nil, err
	}

	var kv map[interface{}]interface{}
	if len(item.Value) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(item.Value)
		if err != nil {
			return nil, err
		}
	}

	return NewMemcacheStore(p.c, sid, p.expire, kv), nil
}

// Count counts and returns number of sessions.
func (p *MemcacheProvider) Count() int {
	// FIXME: how come this library does not have Stats method?
	return -1
}

// GC calls GC to clean expired sessions.
func (p *MemcacheProvider) GC() {}

func init() {
	session.Register("memcache", &MemcacheProvider{})
}

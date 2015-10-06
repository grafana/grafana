// Copyright 2015 Unknwon
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
	"sync"

	"github.com/lunny/nodb"
	"github.com/lunny/nodb/config"

	"github.com/macaron-contrib/session"
)

// NodbStore represents a nodb session store implementation.
type NodbStore struct {
	c      *nodb.DB
	sid    string
	expire int64
	lock   sync.RWMutex
	data   map[interface{}]interface{}
}

// NewNodbStore creates and returns a ledis session store.
func NewNodbStore(c *nodb.DB, sid string, expire int64, kv map[interface{}]interface{}) *NodbStore {
	return &NodbStore{
		c:      c,
		expire: expire,
		sid:    sid,
		data:   kv,
	}
}

// Set sets value to given key in session.
func (s *NodbStore) Set(key, val interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = val
	return nil
}

// Get gets value by given key in session.
func (s *NodbStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *NodbStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *NodbStore) ID() string {
	return s.sid
}

// Release releases resource and save data to provider.
func (s *NodbStore) Release() error {
	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}

	if err = s.c.Set([]byte(s.sid), data); err != nil {
		return err
	}
	_, err = s.c.Expire([]byte(s.sid), s.expire)
	return err
}

// Flush deletes all session data.
func (s *NodbStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// NodbProvider represents a ledis session provider implementation.
type NodbProvider struct {
	c      *nodb.DB
	expire int64
}

// Init initializes nodb session provider.
func (p *NodbProvider) Init(expire int64, configs string) error {
	p.expire = expire

	cfg := new(config.Config)
	cfg.DataDir = configs
	dbs, err := nodb.Open(cfg)
	if err != nil {
		return fmt.Errorf("session/nodb: error opening db: %v", err)
	}

	p.c, err = dbs.Select(0)
	return err
}

// Read returns raw session store by session ID.
func (p *NodbProvider) Read(sid string) (session.RawStore, error) {
	if !p.Exist(sid) {
		if err := p.c.Set([]byte(sid), []byte("")); err != nil {
			return nil, err
		}
	}

	var kv map[interface{}]interface{}
	kvs, err := p.c.Get([]byte(sid))
	if err != nil {
		return nil, err
	}
	if len(kvs) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(kvs)
		if err != nil {
			return nil, err
		}
	}

	return NewNodbStore(p.c, sid, p.expire, kv), nil
}

// Exist returns true if session with given ID exists.
func (p *NodbProvider) Exist(sid string) bool {
	count, err := p.c.Exists([]byte(sid))
	return err == nil && count > 0
}

// Destory deletes a session by session ID.
func (p *NodbProvider) Destory(sid string) error {
	_, err := p.c.Del([]byte(sid))
	return err
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *NodbProvider) Regenerate(oldsid, sid string) (_ session.RawStore, err error) {
	if p.Exist(sid) {
		return nil, fmt.Errorf("new sid '%s' already exists", sid)
	}

	kvs := make([]byte, 0)
	if p.Exist(oldsid) {
		if kvs, err = p.c.Get([]byte(oldsid)); err != nil {
			return nil, err
		} else if _, err = p.c.Del([]byte(oldsid)); err != nil {
			return nil, err
		}
	}

	if err = p.c.Set([]byte(sid), kvs); err != nil {
		return nil, err
	} else if _, err = p.c.Expire([]byte(sid), p.expire); err != nil {
		return nil, err
	}

	var kv map[interface{}]interface{}
	if len(kvs) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob([]byte(kvs))
		if err != nil {
			return nil, err
		}
	}

	return NewNodbStore(p.c, sid, p.expire, kv), nil
}

// Count counts and returns number of sessions.
func (p *NodbProvider) Count() int {
	// FIXME: how come this library does not have DbSize() method?
	return -1
}

// GC calls GC to clean expired sessions.
func (p *NodbProvider) GC() {}

func init() {
	session.Register("nodb", &NodbProvider{})
}

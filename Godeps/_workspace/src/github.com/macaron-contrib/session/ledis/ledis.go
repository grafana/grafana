// Copyright 2013 Beego Authors
// Copyright 2014 Unknwon
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
	"sync"

	"github.com/siddontang/ledisdb/config"
	"github.com/siddontang/ledisdb/ledis"

	"github.com/macaron-contrib/session"
)

var c *ledis.DB

// LedisSessionStore represents a ledis session store implementation.
type LedisSessionStore struct {
	sid         string
	lock        sync.RWMutex
	data        map[interface{}]interface{}
	maxlifetime int64
}

// Set sets value to given key in session.
func (s *LedisSessionStore) Set(key, val interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = val
	return nil
}

// Get gets value by given key in session.
func (s *LedisSessionStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *LedisSessionStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *LedisSessionStore) ID() string {
	return s.sid
}

// Release releases resource and save data to provider.
func (s *LedisSessionStore) Release() error {
	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}
	if err = c.Set([]byte(s.sid), data); err != nil {
		return err
	}
	_, err = c.Expire([]byte(s.sid), s.maxlifetime)
	return err
}

// Flush deletes all session data.
func (s *LedisSessionStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// LedisProvider represents a ledis session provider implementation.
type LedisProvider struct {
	maxlifetime int64
	savePath    string
}

// Init initializes memory session provider.
func (p *LedisProvider) Init(maxlifetime int64, savePath string) error {
	p.maxlifetime = maxlifetime
	p.savePath = savePath
	cfg := new(config.Config)
	cfg.DataDir = p.savePath
	var err error
	nowLedis, err := ledis.Open(cfg)
	c, err = nowLedis.Select(0)
	if err != nil {
		println(err)
		return nil
	}
	return nil
}

// Read returns raw session store by session ID.
func (p *LedisProvider) Read(sid string) (session.RawStore, error) {
	kvs, err := c.Get([]byte(sid))
	var kv map[interface{}]interface{}
	if len(kvs) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(kvs)
		if err != nil {
			return nil, err
		}
	}
	ls := &LedisSessionStore{sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return ls, nil
}

// Exist returns true if session with given ID exists.
func (p *LedisProvider) Exist(sid string) bool {
	count, _ := c.Exists([]byte(sid))
	if count == 0 {
		return false
	} else {
		return true
	}
}

// Destory deletes a session by session ID.
func (p *LedisProvider) Destory(sid string) error {
	_, err := c.Del([]byte(sid))
	return err
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *LedisProvider) Regenerate(oldsid, sid string) (session.RawStore, error) {
	count, _ := c.Exists([]byte(sid))
	if count == 0 {
		// oldsid doesn't exists, set the new sid directly
		// ignore error here, since if it return error
		// the existed value will be 0
		c.Set([]byte(sid), []byte(""))
		c.Expire([]byte(sid), p.maxlifetime)
	} else {
		data, _ := c.Get([]byte(oldsid))
		c.Set([]byte(sid), data)
		c.Expire([]byte(sid), p.maxlifetime)
	}
	kvs, err := c.Get([]byte(sid))
	var kv map[interface{}]interface{}
	if len(kvs) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob([]byte(kvs))
		if err != nil {
			return nil, err
		}
	}
	ls := &LedisSessionStore{sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return ls, nil
}

// Count counts and returns number of sessions.
func (p *LedisProvider) Count() int {
	// FIXME
	return 0
}

// GC calls GC to clean expired sessions.
func (p *LedisProvider) GC() {}

func init() {
	session.Register("ledis", &LedisProvider{})
}

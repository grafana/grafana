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
	"strings"
	"sync"

	"github.com/bradfitz/gomemcache/memcache"

	"github.com/macaron-contrib/session"
)

var (
	client *memcache.Client
)

// MemcacheSessionStore represents a memcache session store implementation.
type MemcacheSessionStore struct {
	sid         string
	lock        sync.RWMutex
	data        map[interface{}]interface{}
	maxlifetime int64
}

// Set sets value to given key in session.
func (s *MemcacheSessionStore) Set(key, val interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = val
	return nil
}

// Get gets value by given key in session.
func (s *MemcacheSessionStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *MemcacheSessionStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *MemcacheSessionStore) ID() string {
	return s.sid
}

// Release releases resource and save data to provider.
func (s *MemcacheSessionStore) Release() error {
	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}

	return client.Set(&memcache.Item{
		Key:        s.sid,
		Value:      data,
		Expiration: int32(s.maxlifetime),
	})
}

// Flush deletes all session data.
func (s *MemcacheSessionStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// MemProvider represents a memcache session provider implementation.
type MemProvider struct {
	maxlifetime int64
	conninfo    []string
	poolsize    int
	password    string
}

// Init initializes memory session provider.
// connStrs can be multiple connection strings separate by ;
// e.g. 127.0.0.1:9090
func (p *MemProvider) Init(maxlifetime int64, connStrs string) error {
	p.maxlifetime = maxlifetime
	p.conninfo = strings.Split(connStrs, ";")
	client = memcache.New(p.conninfo...)
	return nil
}

func (p *MemProvider) connectInit() error {
	client = memcache.New(p.conninfo...)
	return nil
}

// Read returns raw session store by session ID.
func (p *MemProvider) Read(sid string) (session.RawStore, error) {
	if client == nil {
		if err := p.connectInit(); err != nil {
			return nil, err
		}
	}

	item, err := client.Get(sid)
	if err != nil {
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

	rs := &MemcacheSessionStore{sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return rs, nil
}

// Exist returns true if session with given ID exists.
func (p *MemProvider) Exist(sid string) bool {
	if client == nil {
		if err := p.connectInit(); err != nil {
			return false
		}
	}

	if item, err := client.Get(sid); err != nil || len(item.Value) == 0 {
		return false
	} else {
		return true
	}
}

// Destory deletes a session by session ID.
func (p *MemProvider) Destory(sid string) error {
	if client == nil {
		if err := p.connectInit(); err != nil {
			return err
		}
	}

	return client.Delete(sid)
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *MemProvider) Regenerate(oldsid, sid string) (session.RawStore, error) {
	if client == nil {
		if err := p.connectInit(); err != nil {
			return nil, err
		}
	}

	var contain []byte
	if item, err := client.Get(sid); err != nil || len(item.Value) == 0 {
		// oldsid doesn't exists, set the new sid directly
		// ignore error here, since if it return error
		// the existed value will be 0
		item.Key = sid
		item.Value = []byte("")
		item.Expiration = int32(p.maxlifetime)
		client.Set(item)
	} else {
		client.Delete(oldsid)
		item.Key = sid
		item.Value = item.Value
		item.Expiration = int32(p.maxlifetime)
		client.Set(item)
		contain = item.Value
	}

	var kv map[interface{}]interface{}
	if len(contain) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		var err error
		kv, err = session.DecodeGob(contain)
		if err != nil {
			return nil, err
		}
	}

	rs := &MemcacheSessionStore{sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return rs, nil
}

// Count counts and returns number of sessions.
func (p *MemProvider) Count() int {
	// FIXME
	return 0
}

// GC calls GC to clean expired sessions.
func (p *MemProvider) GC() {}

func init() {
	session.Register("memcache", &MemProvider{})
}

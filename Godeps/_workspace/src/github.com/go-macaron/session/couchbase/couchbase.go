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
	"strings"
	"sync"

	"github.com/couchbaselabs/go-couchbase"

	"github.com/go-macaron/session"
)

// CouchbaseSessionStore represents a couchbase session store implementation.
type CouchbaseSessionStore struct {
	b           *couchbase.Bucket
	sid         string
	lock        sync.RWMutex
	data        map[interface{}]interface{}
	maxlifetime int64
}

// Set sets value to given key in session.
func (s *CouchbaseSessionStore) Set(key, val interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = val
	return nil
}

// Get gets value by given key in session.
func (s *CouchbaseSessionStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *CouchbaseSessionStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *CouchbaseSessionStore) ID() string {
	return s.sid
}

// Release releases resource and save data to provider.
func (s *CouchbaseSessionStore) Release() error {
	defer s.b.Close()

	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}

	return s.b.Set(s.sid, int(s.maxlifetime), data)
}

// Flush deletes all session data.
func (s *CouchbaseSessionStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// CouchbaseProvider represents a couchbase session provider implementation.
type CouchbaseProvider struct {
	maxlifetime int64
	connStr     string
	pool        string
	bucket      string
	b           *couchbase.Bucket
}

func (cp *CouchbaseProvider) getBucket() *couchbase.Bucket {
	c, err := couchbase.Connect(cp.connStr)
	if err != nil {
		return nil
	}

	pool, err := c.GetPool(cp.pool)
	if err != nil {
		return nil
	}

	bucket, err := pool.GetBucket(cp.bucket)
	if err != nil {
		return nil
	}

	return bucket
}

// Init initializes memory session provider.
// connStr is couchbase server REST/JSON URL
// e.g. http://host:port/, Pool, Bucket
func (p *CouchbaseProvider) Init(maxlifetime int64, connStr string) error {
	p.maxlifetime = maxlifetime
	configs := strings.Split(connStr, ",")
	if len(configs) > 0 {
		p.connStr = configs[0]
	}
	if len(configs) > 1 {
		p.pool = configs[1]
	}
	if len(configs) > 2 {
		p.bucket = configs[2]
	}

	return nil
}

// Read returns raw session store by session ID.
func (p *CouchbaseProvider) Read(sid string) (session.RawStore, error) {
	p.b = p.getBucket()

	var doc []byte

	err := p.b.Get(sid, &doc)
	var kv map[interface{}]interface{}
	if doc == nil {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(doc)
		if err != nil {
			return nil, err
		}
	}

	cs := &CouchbaseSessionStore{b: p.b, sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return cs, nil
}

// Exist returns true if session with given ID exists.
func (p *CouchbaseProvider) Exist(sid string) bool {
	p.b = p.getBucket()
	defer p.b.Close()

	var doc []byte

	if err := p.b.Get(sid, &doc); err != nil || doc == nil {
		return false
	} else {
		return true
	}
}

// Destory deletes a session by session ID.
func (p *CouchbaseProvider) Destory(sid string) error {
	p.b = p.getBucket()
	defer p.b.Close()

	p.b.Delete(sid)
	return nil
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *CouchbaseProvider) Regenerate(oldsid, sid string) (session.RawStore, error) {
	p.b = p.getBucket()

	var doc []byte
	if err := p.b.Get(oldsid, &doc); err != nil || doc == nil {
		p.b.Set(sid, int(p.maxlifetime), "")
	} else {
		err := p.b.Delete(oldsid)
		if err != nil {
			return nil, err
		}
		_, _ = p.b.Add(sid, int(p.maxlifetime), doc)
	}

	err := p.b.Get(sid, &doc)
	if err != nil {
		return nil, err
	}
	var kv map[interface{}]interface{}
	if doc == nil {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(doc)
		if err != nil {
			return nil, err
		}
	}

	cs := &CouchbaseSessionStore{b: p.b, sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return cs, nil
}

// Count counts and returns number of sessions.
func (p *CouchbaseProvider) Count() int {
	// FIXME
	return 0
}

// GC calls GC to clean expired sessions.
func (p *CouchbaseProvider) GC() {}

func init() {
	session.Register("couchbase", &CouchbaseProvider{})
}

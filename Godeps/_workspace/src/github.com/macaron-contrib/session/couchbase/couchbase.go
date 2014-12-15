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
	"net/http"
	"strings"
	"sync"

	"github.com/couchbaselabs/go-couchbase"

	"github.com/macaron-contrib/session"
)

var couchbpder = &CouchbaseProvider{}

type CouchbaseSessionStore struct {
	b           *couchbase.Bucket
	sid         string
	lock        sync.RWMutex
	values      map[interface{}]interface{}
	maxlifetime int64
}

type CouchbaseProvider struct {
	maxlifetime int64
	savePath    string
	pool        string
	bucket      string
	b           *couchbase.Bucket
}

func (cs *CouchbaseSessionStore) Set(key, value interface{}) error {
	cs.lock.Lock()
	defer cs.lock.Unlock()
	cs.values[key] = value
	return nil
}

func (cs *CouchbaseSessionStore) Get(key interface{}) interface{} {
	cs.lock.RLock()
	defer cs.lock.RUnlock()
	if v, ok := cs.values[key]; ok {
		return v
	} else {
		return nil
	}
}

func (cs *CouchbaseSessionStore) Delete(key interface{}) error {
	cs.lock.Lock()
	defer cs.lock.Unlock()
	delete(cs.values, key)
	return nil
}

func (cs *CouchbaseSessionStore) Flush() error {
	cs.lock.Lock()
	defer cs.lock.Unlock()
	cs.values = make(map[interface{}]interface{})
	return nil
}

func (cs *CouchbaseSessionStore) SessionID() string {
	return cs.sid
}

func (cs *CouchbaseSessionStore) SessionRelease(w http.ResponseWriter) {
	defer cs.b.Close()

	bo, err := session.EncodeGob(cs.values)
	if err != nil {
		return
	}

	cs.b.Set(cs.sid, int(cs.maxlifetime), bo)
}

func (cp *CouchbaseProvider) getBucket() *couchbase.Bucket {
	c, err := couchbase.Connect(cp.savePath)
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

// init couchbase session
// savepath like couchbase server REST/JSON URL
// e.g. http://host:port/, Pool, Bucket
func (cp *CouchbaseProvider) SessionInit(maxlifetime int64, savePath string) error {
	cp.maxlifetime = maxlifetime
	configs := strings.Split(savePath, ",")
	if len(configs) > 0 {
		cp.savePath = configs[0]
	}
	if len(configs) > 1 {
		cp.pool = configs[1]
	}
	if len(configs) > 2 {
		cp.bucket = configs[2]
	}

	return nil
}

// read couchbase session by sid
func (cp *CouchbaseProvider) SessionRead(sid string) (session.RawStore, error) {
	cp.b = cp.getBucket()

	var doc []byte

	err := cp.b.Get(sid, &doc)
	var kv map[interface{}]interface{}
	if doc == nil {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(doc)
		if err != nil {
			return nil, err
		}
	}

	cs := &CouchbaseSessionStore{b: cp.b, sid: sid, values: kv, maxlifetime: cp.maxlifetime}
	return cs, nil
}

func (cp *CouchbaseProvider) SessionExist(sid string) bool {
	cp.b = cp.getBucket()
	defer cp.b.Close()

	var doc []byte

	if err := cp.b.Get(sid, &doc); err != nil || doc == nil {
		return false
	} else {
		return true
	}
}

func (cp *CouchbaseProvider) SessionRegenerate(oldsid, sid string) (session.RawStore, error) {
	cp.b = cp.getBucket()

	var doc []byte
	if err := cp.b.Get(oldsid, &doc); err != nil || doc == nil {
		cp.b.Set(sid, int(cp.maxlifetime), "")
	} else {
		err := cp.b.Delete(oldsid)
		if err != nil {
			return nil, err
		}
		_, _ = cp.b.Add(sid, int(cp.maxlifetime), doc)
	}

	err := cp.b.Get(sid, &doc)
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

	cs := &CouchbaseSessionStore{b: cp.b, sid: sid, values: kv, maxlifetime: cp.maxlifetime}
	return cs, nil
}

func (cp *CouchbaseProvider) SessionDestroy(sid string) error {
	cp.b = cp.getBucket()
	defer cp.b.Close()

	cp.b.Delete(sid)
	return nil
}

func (cp *CouchbaseProvider) SessionGC() {
	return
}

func (cp *CouchbaseProvider) SessionAll() int {
	return 0
}

func init() {
	session.Register("couchbase", couchbpder)
}

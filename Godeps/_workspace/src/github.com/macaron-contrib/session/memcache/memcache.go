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

	"github.com/bradfitz/gomemcache/memcache"

	"github.com/macaron-contrib/session"
)

var (
	mempder = &MemProvider{}
	client  *memcache.Client
)

// memcache session store
type MemcacheSessionStore struct {
	sid         string
	lock        sync.RWMutex
	values      map[interface{}]interface{}
	maxlifetime int64
}

// set value in memcache session
func (rs *MemcacheSessionStore) Set(key, value interface{}) error {
	rs.lock.Lock()
	defer rs.lock.Unlock()
	rs.values[key] = value
	return nil
}

// get value in memcache session
func (rs *MemcacheSessionStore) Get(key interface{}) interface{} {
	rs.lock.RLock()
	defer rs.lock.RUnlock()
	if v, ok := rs.values[key]; ok {
		return v
	} else {
		return nil
	}
}

// delete value in memcache session
func (rs *MemcacheSessionStore) Delete(key interface{}) error {
	rs.lock.Lock()
	defer rs.lock.Unlock()
	delete(rs.values, key)
	return nil
}

// clear all values in memcache session
func (rs *MemcacheSessionStore) Flush() error {
	rs.lock.Lock()
	defer rs.lock.Unlock()
	rs.values = make(map[interface{}]interface{})
	return nil
}

// get redis session id
func (rs *MemcacheSessionStore) SessionID() string {
	return rs.sid
}

// save session values to redis
func (rs *MemcacheSessionStore) SessionRelease(w http.ResponseWriter) {
	b, err := session.EncodeGob(rs.values)
	if err != nil {
		return
	}

	client.Set(&memcache.Item{
		Key:        rs.sid,
		Value:      b,
		Expiration: int32(rs.maxlifetime),
	})
}

// redis session provider
type MemProvider struct {
	maxlifetime int64
	conninfo    []string
	poolsize    int
	password    string
}

// init redis session
// savepath like
// e.g. 127.0.0.1:9090
func (rp *MemProvider) SessionInit(maxlifetime int64, savePath string) error {
	rp.maxlifetime = maxlifetime
	rp.conninfo = strings.Split(savePath, ";")
	client = memcache.New(rp.conninfo...)
	return nil
}

func (rp *MemProvider) connectInit() error {
	client = memcache.New(rp.conninfo...)
	return nil
}

// read redis session by sid
func (rp *MemProvider) SessionRead(sid string) (session.RawStore, error) {
	if client == nil {
		if err := rp.connectInit(); err != nil {
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

	rs := &MemcacheSessionStore{sid: sid, values: kv, maxlifetime: rp.maxlifetime}
	return rs, nil
}

// check redis session exist by sid
func (rp *MemProvider) SessionExist(sid string) bool {
	if client == nil {
		if err := rp.connectInit(); err != nil {
			return false
		}
	}

	if item, err := client.Get(sid); err != nil || len(item.Value) == 0 {
		return false
	} else {
		return true
	}
}

// generate new sid for redis session
func (rp *MemProvider) SessionRegenerate(oldsid, sid string) (session.RawStore, error) {
	if client == nil {
		if err := rp.connectInit(); err != nil {
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
		item.Expiration = int32(rp.maxlifetime)
		client.Set(item)
	} else {
		client.Delete(oldsid)
		item.Key = sid
		item.Value = item.Value
		item.Expiration = int32(rp.maxlifetime)
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

	rs := &MemcacheSessionStore{sid: sid, values: kv, maxlifetime: rp.maxlifetime}
	return rs, nil
}

// delete redis session by id
func (rp *MemProvider) SessionDestroy(sid string) error {
	if client == nil {
		if err := rp.connectInit(); err != nil {
			return err
		}
	}

	return client.Delete(sid)
}

// Impelment method, no used.
func (rp *MemProvider) SessionGC() {
	return
}

// @todo
func (rp *MemProvider) SessionAll() int {
	return 0
}

func init() {
	session.Register("memcache", mempder)
}

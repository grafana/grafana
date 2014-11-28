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
	"sync"

	"github.com/astaxie/beego/session"
	"github.com/siddontang/ledisdb/config"
	"github.com/siddontang/ledisdb/ledis"
)

var ledispder = &LedisProvider{}
var c *ledis.DB

// ledis session store
type LedisSessionStore struct {
	sid         string
	lock        sync.RWMutex
	values      map[interface{}]interface{}
	maxlifetime int64
}

// set value in ledis session
func (ls *LedisSessionStore) Set(key, value interface{}) error {
	ls.lock.Lock()
	defer ls.lock.Unlock()
	ls.values[key] = value
	return nil
}

// get value in ledis session
func (ls *LedisSessionStore) Get(key interface{}) interface{} {
	ls.lock.RLock()
	defer ls.lock.RUnlock()
	if v, ok := ls.values[key]; ok {
		return v
	} else {
		return nil
	}
}

// delete value in ledis session
func (ls *LedisSessionStore) Delete(key interface{}) error {
	ls.lock.Lock()
	defer ls.lock.Unlock()
	delete(ls.values, key)
	return nil
}

// clear all values in ledis session
func (ls *LedisSessionStore) Flush() error {
	ls.lock.Lock()
	defer ls.lock.Unlock()
	ls.values = make(map[interface{}]interface{})
	return nil
}

// get ledis session id
func (ls *LedisSessionStore) SessionID() string {
	return ls.sid
}

// save session values to ledis
func (ls *LedisSessionStore) SessionRelease(w http.ResponseWriter) {
	b, err := session.EncodeGob(ls.values)
	if err != nil {
		return
	}
	c.Set([]byte(ls.sid), b)
	c.Expire([]byte(ls.sid), ls.maxlifetime)
}

// ledis session provider
type LedisProvider struct {
	maxlifetime int64
	savePath    string
}

// init ledis session
// savepath like ledis server saveDataPath,pool size
// e.g. 127.0.0.1:6379,100,astaxie
func (lp *LedisProvider) SessionInit(maxlifetime int64, savePath string) error {
	lp.maxlifetime = maxlifetime
	lp.savePath = savePath
	cfg := new(config.Config)
	cfg.DataDir = lp.savePath
	var err error
	nowLedis, err := ledis.Open(cfg)
	c, err = nowLedis.Select(0)
	if err != nil {
		println(err)
		return nil
	}
	return nil
}

// read ledis session by sid
func (lp *LedisProvider) SessionRead(sid string) (session.SessionStore, error) {
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
	ls := &LedisSessionStore{sid: sid, values: kv, maxlifetime: lp.maxlifetime}
	return ls, nil
}

// check ledis session exist by sid
func (lp *LedisProvider) SessionExist(sid string) bool {
	count, _ := c.Exists([]byte(sid))
	if count == 0 {
		return false
	} else {
		return true
	}
}

// generate new sid for ledis session
func (lp *LedisProvider) SessionRegenerate(oldsid, sid string) (session.SessionStore, error) {
	count, _ := c.Exists([]byte(sid))
	if count == 0 {
		// oldsid doesn't exists, set the new sid directly
		// ignore error here, since if it return error
		// the existed value will be 0
		c.Set([]byte(sid), []byte(""))
		c.Expire([]byte(sid), lp.maxlifetime)
	} else {
		data, _ := c.Get([]byte(oldsid))
		c.Set([]byte(sid), data)
		c.Expire([]byte(sid), lp.maxlifetime)
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
	ls := &LedisSessionStore{sid: sid, values: kv, maxlifetime: lp.maxlifetime}
	return ls, nil
}

// delete ledis session by id
func (lp *LedisProvider) SessionDestroy(sid string) error {
	c.Del([]byte(sid))
	return nil
}

// Impelment method, no used.
func (lp *LedisProvider) SessionGC() {
	return
}

// @todo
func (lp *LedisProvider) SessionAll() int {
	return 0
}

func init() {
	session.Register("ledis", ledispder)
}

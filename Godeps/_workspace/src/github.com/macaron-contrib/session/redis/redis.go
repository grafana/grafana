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
	"strconv"
	"strings"
	"sync"

	"github.com/beego/redigo/redis"

	"github.com/macaron-contrib/session"
)

var redispder = &RedisProvider{}

// redis max pool size
var MAX_POOL_SIZE = 100

var redisPool chan redis.Conn

// redis session store
type RedisSessionStore struct {
	p           *redis.Pool
	sid         string
	lock        sync.RWMutex
	values      map[interface{}]interface{}
	maxlifetime int64
}

// set value in redis session
func (rs *RedisSessionStore) Set(key, value interface{}) error {
	rs.lock.Lock()
	defer rs.lock.Unlock()
	rs.values[key] = value
	return nil
}

// get value in redis session
func (rs *RedisSessionStore) Get(key interface{}) interface{} {
	rs.lock.RLock()
	defer rs.lock.RUnlock()
	if v, ok := rs.values[key]; ok {
		return v
	} else {
		return nil
	}
}

// delete value in redis session
func (rs *RedisSessionStore) Delete(key interface{}) error {
	rs.lock.Lock()
	defer rs.lock.Unlock()
	delete(rs.values, key)
	return nil
}

// clear all values in redis session
func (rs *RedisSessionStore) Flush() error {
	rs.lock.Lock()
	defer rs.lock.Unlock()
	rs.values = make(map[interface{}]interface{})
	return nil
}

// get redis session id
func (rs *RedisSessionStore) SessionID() string {
	return rs.sid
}

// save session values to redis
func (rs *RedisSessionStore) SessionRelease(w http.ResponseWriter) {
	c := rs.p.Get()
	defer c.Close()

	b, err := session.EncodeGob(rs.values)
	if err != nil {
		return
	}

	c.Do("SETEX", rs.sid, rs.maxlifetime, string(b))
}

// redis session provider
type RedisProvider struct {
	maxlifetime int64
	savePath    string
	poolsize    int
	password    string
	poollist    *redis.Pool
}

// init redis session
// savepath like redis server addr,pool size,password
// e.g. 127.0.0.1:6379,100,astaxie
func (rp *RedisProvider) SessionInit(maxlifetime int64, savePath string) error {
	rp.maxlifetime = maxlifetime
	configs := strings.Split(savePath, ",")
	if len(configs) > 0 {
		rp.savePath = configs[0]
	}
	if len(configs) > 1 {
		poolsize, err := strconv.Atoi(configs[1])
		if err != nil || poolsize <= 0 {
			rp.poolsize = MAX_POOL_SIZE
		} else {
			rp.poolsize = poolsize
		}
	} else {
		rp.poolsize = MAX_POOL_SIZE
	}
	if len(configs) > 2 {
		rp.password = configs[2]
	}
	rp.poollist = redis.NewPool(func() (redis.Conn, error) {
		c, err := redis.Dial("tcp", rp.savePath)
		if err != nil {
			return nil, err
		}
		if rp.password != "" {
			if _, err := c.Do("AUTH", rp.password); err != nil {
				c.Close()
				return nil, err
			}
		}
		return c, err
	}, rp.poolsize)

	return rp.poollist.Get().Err()
}

// read redis session by sid
func (rp *RedisProvider) SessionRead(sid string) (session.RawStore, error) {
	c := rp.poollist.Get()
	defer c.Close()

	kvs, err := redis.String(c.Do("GET", sid))
	var kv map[interface{}]interface{}
	if len(kvs) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob([]byte(kvs))
		if err != nil {
			return nil, err
		}
	}

	rs := &RedisSessionStore{p: rp.poollist, sid: sid, values: kv, maxlifetime: rp.maxlifetime}
	return rs, nil
}

// check redis session exist by sid
func (rp *RedisProvider) SessionExist(sid string) bool {
	c := rp.poollist.Get()
	defer c.Close()

	if existed, err := redis.Int(c.Do("EXISTS", sid)); err != nil || existed == 0 {
		return false
	} else {
		return true
	}
}

// generate new sid for redis session
func (rp *RedisProvider) SessionRegenerate(oldsid, sid string) (session.RawStore, error) {
	c := rp.poollist.Get()
	defer c.Close()

	if existed, _ := redis.Int(c.Do("EXISTS", oldsid)); existed == 0 {
		// oldsid doesn't exists, set the new sid directly
		// ignore error here, since if it return error
		// the existed value will be 0
		c.Do("SET", sid, "", "EX", rp.maxlifetime)
	} else {
		c.Do("RENAME", oldsid, sid)
		c.Do("EXPIRE", sid, rp.maxlifetime)
	}

	kvs, err := redis.String(c.Do("GET", sid))
	var kv map[interface{}]interface{}
	if len(kvs) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob([]byte(kvs))
		if err != nil {
			return nil, err
		}
	}

	rs := &RedisSessionStore{p: rp.poollist, sid: sid, values: kv, maxlifetime: rp.maxlifetime}
	return rs, nil
}

// delete redis session by id
func (rp *RedisProvider) SessionDestroy(sid string) error {
	c := rp.poollist.Get()
	defer c.Close()

	c.Do("DEL", sid)
	return nil
}

// Impelment method, no used.
func (rp *RedisProvider) SessionGC() {
	return
}

// @todo
func (rp *RedisProvider) SessionAll() int {
	return 0
}

func init() {
	session.Register("redis", redispder)
}

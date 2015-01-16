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
	"strconv"
	"strings"
	"sync"

	"github.com/beego/redigo/redis"

	"github.com/macaron-contrib/session"
)

// redis max pool size
var MAX_POOL_SIZE = 100

var redisPool chan redis.Conn

// RedisSessionStore represents a redis session store implementation.
type RedisSessionStore struct {
	p           *redis.Pool
	sid         string
	lock        sync.RWMutex
	data        map[interface{}]interface{}
	maxlifetime int64
}

// Set sets value to given key in session.
func (s *RedisSessionStore) Set(key, val interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = val
	return nil
}

// Get gets value by given key in session.
func (s *RedisSessionStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *RedisSessionStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *RedisSessionStore) ID() string {
	return s.sid
}

// Release releases resource and save data to provider.
func (s *RedisSessionStore) Release() error {
	c := s.p.Get()
	defer c.Close()

	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}

	_, err = c.Do("SETEX", s.sid, s.maxlifetime, string(data))
	return err
}

// Flush deletes all session data.
func (s *RedisSessionStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// RedisProvider represents a redis session provider implementation.
type RedisProvider struct {
	maxlifetime int64
	connAddr    string
	poolsize    int
	password    string
	poollist    *redis.Pool
}

// Init initializes memory session provider.
// connStr: <redis server addr>,<pool size>,<password>
// e.g. 127.0.0.1:6379,100,macaron
func (p *RedisProvider) Init(maxlifetime int64, connStr string) error {
	p.maxlifetime = maxlifetime
	configs := strings.Split(connStr, ",")
	if len(configs) > 0 {
		p.connAddr = configs[0]
	}
	if len(configs) > 1 {
		poolsize, err := strconv.Atoi(configs[1])
		if err != nil || poolsize <= 0 {
			p.poolsize = MAX_POOL_SIZE
		} else {
			p.poolsize = poolsize
		}
	} else {
		p.poolsize = MAX_POOL_SIZE
	}
	if len(configs) > 2 {
		p.password = configs[2]
	}
	p.poollist = redis.NewPool(func() (redis.Conn, error) {
		c, err := redis.Dial("tcp", p.connAddr)
		if err != nil {
			return nil, err
		}
		if p.password != "" {
			if _, err := c.Do("AUTH", p.password); err != nil {
				c.Close()
				return nil, err
			}
		}
		return c, err
	}, p.poolsize)

	return p.poollist.Get().Err()
}

// Read returns raw session store by session ID.
func (p *RedisProvider) Read(sid string) (session.RawStore, error) {
	c := p.poollist.Get()
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

	rs := &RedisSessionStore{p: p.poollist, sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return rs, nil
}

// Exist returns true if session with given ID exists.
func (p *RedisProvider) Exist(sid string) bool {
	c := p.poollist.Get()
	defer c.Close()

	if existed, err := redis.Int(c.Do("EXISTS", sid)); err != nil || existed == 0 {
		return false
	} else {
		return true
	}
}

// Destory deletes a session by session ID.
func (p *RedisProvider) Destory(sid string) error {
	c := p.poollist.Get()
	defer c.Close()

	_, err := c.Do("DEL", sid)
	return err
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *RedisProvider) Regenerate(oldsid, sid string) (session.RawStore, error) {
	c := p.poollist.Get()
	defer c.Close()

	if existed, _ := redis.Int(c.Do("EXISTS", oldsid)); existed == 0 {
		// oldsid doesn't exists, set the new sid directly
		// ignore error here, since if it return error
		// the existed value will be 0
		c.Do("SET", sid, "", "EX", p.maxlifetime)
	} else {
		c.Do("RENAME", oldsid, sid)
		c.Do("EXPIRE", sid, p.maxlifetime)
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

	rs := &RedisSessionStore{p: p.poollist, sid: sid, data: kv, maxlifetime: p.maxlifetime}
	return rs, nil
}

// Count counts and returns number of sessions.
func (p *RedisProvider) Count() int {
	// FIXME
	return 0
}

// GC calls GC to clean expired sessions.
func (_ *RedisProvider) GC() {}

func init() {
	session.Register("redis", &RedisProvider{})
}

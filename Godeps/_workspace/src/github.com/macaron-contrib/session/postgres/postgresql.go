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
	"database/sql"
	"sync"
	"time"

	_ "github.com/lib/pq"

	"github.com/macaron-contrib/session"
)

// PostgresqlSessionStore represents a postgresql session store implementation.
type PostgresqlSessionStore struct {
	c    *sql.DB
	sid  string
	lock sync.RWMutex
	data map[interface{}]interface{}
}

// Set sets value to given key in session.
func (s *PostgresqlSessionStore) Set(key, value interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = value
	return nil
}

// Get gets value by given key in session.
func (s *PostgresqlSessionStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *PostgresqlSessionStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *PostgresqlSessionStore) ID() string {
	return s.sid
}

// save postgresql session values to database.
// must call this method to save values to database.
func (s *PostgresqlSessionStore) Release() error {
	defer s.c.Close()

	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}

	_, err = s.c.Exec("UPDATE session set session_data=$1, session_expiry=$2 where session_key=$3",
		data, time.Now().Format(time.RFC3339), s.sid)
	return err
}

// Flush deletes all session data.
func (s *PostgresqlSessionStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// PostgresqlProvider represents a postgresql session provider implementation.
type PostgresqlProvider struct {
	maxlifetime int64
	connStr     string
}

func (p *PostgresqlProvider) connectInit() *sql.DB {
	db, e := sql.Open("postgres", p.connStr)
	if e != nil {
		return nil
	}
	return db
}

// Init initializes memory session provider.
func (p *PostgresqlProvider) Init(maxlifetime int64, connStr string) error {
	p.maxlifetime = maxlifetime
	p.connStr = connStr
	return nil
}

// Read returns raw session store by session ID.
func (p *PostgresqlProvider) Read(sid string) (session.RawStore, error) {
	c := p.connectInit()
	row := c.QueryRow("select session_data from session where session_key=$1", sid)
	var sessiondata []byte
	err := row.Scan(&sessiondata)
	if err == sql.ErrNoRows {
		_, err = c.Exec("insert into session(session_key,session_data,session_expiry) values($1,$2,$3)",
			sid, "", time.Now().Format(time.RFC3339))

		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	var kv map[interface{}]interface{}
	if len(sessiondata) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(sessiondata)
		if err != nil {
			return nil, err
		}
	}
	rs := &PostgresqlSessionStore{c: c, sid: sid, data: kv}
	return rs, nil
}

// Exist returns true if session with given ID exists.
func (p *PostgresqlProvider) Exist(sid string) bool {
	c := p.connectInit()
	defer c.Close()
	row := c.QueryRow("select session_data from session where session_key=$1", sid)
	var sessiondata []byte
	err := row.Scan(&sessiondata)

	if err == sql.ErrNoRows {
		return false
	} else {
		return true
	}
}

// Destory deletes a session by session ID.
func (p *PostgresqlProvider) Destory(sid string) (err error) {
	c := p.connectInit()
	if _, err = c.Exec("DELETE FROM session where session_key=$1", sid); err != nil {
		return err
	}
	return c.Close()
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *PostgresqlProvider) Regenerate(oldsid, sid string) (session.RawStore, error) {
	c := p.connectInit()
	row := c.QueryRow("select session_data from session where session_key=$1", oldsid)
	var sessiondata []byte
	err := row.Scan(&sessiondata)
	if err == sql.ErrNoRows {
		c.Exec("insert into session(session_key,session_data,session_expiry) values($1,$2,$3)",
			oldsid, "", time.Now().Format(time.RFC3339))
	}
	c.Exec("update session set session_key=$1 where session_key=$2", sid, oldsid)
	var kv map[interface{}]interface{}
	if len(sessiondata) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(sessiondata)
		if err != nil {
			return nil, err
		}
	}
	rs := &PostgresqlSessionStore{c: c, sid: sid, data: kv}
	return rs, nil
}

// Count counts and returns number of sessions.
func (p *PostgresqlProvider) Count() int {
	c := p.connectInit()
	defer c.Close()
	var total int
	err := c.QueryRow("SELECT count(*) as num from session").Scan(&total)
	if err != nil {
		return 0
	}
	return total
}

// GC calls GC to clean expired sessions.
func (mp *PostgresqlProvider) GC() {
	c := mp.connectInit()
	c.Exec("DELETE from session where EXTRACT(EPOCH FROM (current_timestamp - session_expiry)) > $1", mp.maxlifetime)
	c.Close()
}

func init() {
	session.Register("postgresql", &PostgresqlProvider{})
}

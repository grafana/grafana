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
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	_ "github.com/lib/pq"

	"github.com/go-macaron/session"
)

// PostgresStore represents a postgres session store implementation.
type PostgresStore struct {
	c    *sql.DB
	sid  string
	lock sync.RWMutex
	data map[interface{}]interface{}
}

// NewPostgresStore creates and returns a postgres session store.
func NewPostgresStore(c *sql.DB, sid string, kv map[interface{}]interface{}) *PostgresStore {
	return &PostgresStore{
		c:    c,
		sid:  sid,
		data: kv,
	}
}

// Set sets value to given key in session.
func (s *PostgresStore) Set(key, value interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data[key] = value
	return nil
}

// Get gets value by given key in session.
func (s *PostgresStore) Get(key interface{}) interface{} {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.data[key]
}

// Delete delete a key from session.
func (s *PostgresStore) Delete(key interface{}) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.data, key)
	return nil
}

// ID returns current session ID.
func (s *PostgresStore) ID() string {
	return s.sid
}

// save postgres session values to database.
// must call this method to save values to database.
func (s *PostgresStore) Release() error {
	data, err := session.EncodeGob(s.data)
	if err != nil {
		return err
	}

	_, err = s.c.Exec("UPDATE session SET data=$1, expiry=$2 WHERE key=$3",
		data, time.Now().Unix(), s.sid)
	return err
}

// Flush deletes all session data.
func (s *PostgresStore) Flush() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = make(map[interface{}]interface{})
	return nil
}

// PostgresProvider represents a postgres session provider implementation.
type PostgresProvider struct {
	c           *sql.DB
	maxlifetime int64
}

// Init initializes postgres session provider.
// connStr: user=a password=b host=localhost port=5432 dbname=c sslmode=disable
func (p *PostgresProvider) Init(maxlifetime int64, connStr string) (err error) {
	p.maxlifetime = maxlifetime

	p.c, err = sql.Open("postgres", connStr)
	if err != nil {
		return err
	}
	return p.c.Ping()
}

// Read returns raw session store by session ID.
func (p *PostgresProvider) Read(sid string) (session.RawStore, error) {
	var data []byte
	err := p.c.QueryRow("SELECT data FROM session WHERE key=$1", sid).Scan(&data)
	if err == sql.ErrNoRows {
		_, err = p.c.Exec("INSERT INTO session(key,data,expiry) VALUES($1,$2,$3)",
			sid, "", time.Now().Unix())
	}
	if err != nil {
		return nil, err
	}

	var kv map[interface{}]interface{}
	if len(data) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(data)
		if err != nil {
			return nil, err
		}
	}

	return NewPostgresStore(p.c, sid, kv), nil
}

// Exist returns true if session with given ID exists.
func (p *PostgresProvider) Exist(sid string) bool {
	var data []byte
	err := p.c.QueryRow("SELECT data FROM session WHERE key=$1", sid).Scan(&data)
	if err != nil && err != sql.ErrNoRows {
		panic("session/postgres: error checking existence: " + err.Error())
	}
	return err != sql.ErrNoRows
}

// Destory deletes a session by session ID.
func (p *PostgresProvider) Destory(sid string) error {
	_, err := p.c.Exec("DELETE FROM session WHERE key=$1", sid)
	return err
}

// Regenerate regenerates a session store from old session ID to new one.
func (p *PostgresProvider) Regenerate(oldsid, sid string) (_ session.RawStore, err error) {
	if p.Exist(sid) {
		return nil, fmt.Errorf("new sid '%s' already exists", sid)
	}

	if !p.Exist(oldsid) {
		if _, err = p.c.Exec("INSERT INTO session(key,data,expiry) VALUES($1,$2,$3)",
			oldsid, "", time.Now().Unix()); err != nil {
			return nil, err
		}
	}

	if _, err = p.c.Exec("UPDATE session SET key=$1 WHERE key=$2", sid, oldsid); err != nil {
		return nil, err
	}

	return p.Read(sid)
}

// Count counts and returns number of sessions.
func (p *PostgresProvider) Count() (total int) {
	if err := p.c.QueryRow("SELECT COUNT(*) AS NUM FROM session").Scan(&total); err != nil {
		panic("session/postgres: error counting records: " + err.Error())
	}
	return total
}

// GC calls GC to clean expired sessions.
func (p *PostgresProvider) GC() {
	if _, err := p.c.Exec("DELETE FROM session WHERE EXTRACT(EPOCH FROM NOW()) - expiry > $1", p.maxlifetime); err != nil {
		log.Printf("session/postgres: error garbage collecting: %v", err)
	}
}

func init() {
	session.Register("postgres", &PostgresProvider{})
}

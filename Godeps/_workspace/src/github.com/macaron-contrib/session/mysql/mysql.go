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

// mysql session support need create table as sql:
//	CREATE TABLE `session` (
//	`session_key` char(64) NOT NULL,
//	session_data` blob,
//	`session_expiry` int(11) unsigned NOT NULL,
//	PRIMARY KEY (`session_key`)
//	) ENGINE=MyISAM DEFAULT CHARSET=utf8;

import (
	"database/sql"
	"net/http"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"github.com/macaron-contrib/session"
)

var mysqlpder = &MysqlProvider{}

// mysql session store
type MysqlSessionStore struct {
	c      *sql.DB
	sid    string
	lock   sync.RWMutex
	values map[interface{}]interface{}
}

// set value in mysql session.
// it is temp value in map.
func (st *MysqlSessionStore) Set(key, value interface{}) error {
	st.lock.Lock()
	defer st.lock.Unlock()
	st.values[key] = value
	return nil
}

// get value from mysql session
func (st *MysqlSessionStore) Get(key interface{}) interface{} {
	st.lock.RLock()
	defer st.lock.RUnlock()
	if v, ok := st.values[key]; ok {
		return v
	} else {
		return nil
	}
}

// delete value in mysql session
func (st *MysqlSessionStore) Delete(key interface{}) error {
	st.lock.Lock()
	defer st.lock.Unlock()
	delete(st.values, key)
	return nil
}

// clear all values in mysql session
func (st *MysqlSessionStore) Flush() error {
	st.lock.Lock()
	defer st.lock.Unlock()
	st.values = make(map[interface{}]interface{})
	return nil
}

// get session id of this mysql session store
func (st *MysqlSessionStore) SessionID() string {
	return st.sid
}

// save mysql session values to database.
// must call this method to save values to database.
func (st *MysqlSessionStore) SessionRelease(w http.ResponseWriter) {
	defer st.c.Close()
	b, err := session.EncodeGob(st.values)
	if err != nil {
		return
	}
	st.c.Exec("UPDATE session set `session_data`=?, `session_expiry`=? where session_key=?",
		b, time.Now().Unix(), st.sid)

}

// mysql session provider
type MysqlProvider struct {
	maxlifetime int64
	savePath    string
}

// connect to mysql
func (mp *MysqlProvider) connectInit() *sql.DB {
	db, e := sql.Open("mysql", mp.savePath)
	if e != nil {
		return nil
	}
	return db
}

// init mysql session.
// savepath is the connection string of mysql.
func (mp *MysqlProvider) SessionInit(maxlifetime int64, savePath string) error {
	mp.maxlifetime = maxlifetime
	mp.savePath = savePath
	return nil
}

// get mysql session by sid
func (mp *MysqlProvider) SessionRead(sid string) (session.RawStore, error) {
	c := mp.connectInit()
	row := c.QueryRow("select session_data from session where session_key=?", sid)
	var sessiondata []byte
	err := row.Scan(&sessiondata)
	if err == sql.ErrNoRows {
		c.Exec("insert into session(`session_key`,`session_data`,`session_expiry`) values(?,?,?)",
			sid, "", time.Now().Unix())
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
	rs := &MysqlSessionStore{c: c, sid: sid, values: kv}
	return rs, nil
}

// check mysql session exist
func (mp *MysqlProvider) SessionExist(sid string) bool {
	c := mp.connectInit()
	defer c.Close()
	row := c.QueryRow("select session_data from session where session_key=?", sid)
	var sessiondata []byte
	err := row.Scan(&sessiondata)
	if err == sql.ErrNoRows {
		return false
	} else {
		return true
	}
}

// generate new sid for mysql session
func (mp *MysqlProvider) SessionRegenerate(oldsid, sid string) (session.RawStore, error) {
	c := mp.connectInit()
	row := c.QueryRow("select session_data from session where session_key=?", oldsid)
	var sessiondata []byte
	err := row.Scan(&sessiondata)
	if err == sql.ErrNoRows {
		c.Exec("insert into session(`session_key`,`session_data`,`session_expiry`) values(?,?,?)", oldsid, "", time.Now().Unix())
	}
	c.Exec("update session set `session_key`=? where session_key=?", sid, oldsid)
	var kv map[interface{}]interface{}
	if len(sessiondata) == 0 {
		kv = make(map[interface{}]interface{})
	} else {
		kv, err = session.DecodeGob(sessiondata)
		if err != nil {
			return nil, err
		}
	}
	rs := &MysqlSessionStore{c: c, sid: sid, values: kv}
	return rs, nil
}

// delete mysql session by sid
func (mp *MysqlProvider) SessionDestroy(sid string) error {
	c := mp.connectInit()
	c.Exec("DELETE FROM session where session_key=?", sid)
	c.Close()
	return nil
}

// delete expired values in mysql session
func (mp *MysqlProvider) SessionGC() {
	c := mp.connectInit()
	c.Exec("DELETE from session where session_expiry < ?", time.Now().Unix()-mp.maxlifetime)
	c.Close()
	return
}

// count values in mysql session
func (mp *MysqlProvider) SessionAll() int {
	c := mp.connectInit()
	defer c.Close()
	var total int
	err := c.QueryRow("SELECT count(*) as num from session").Scan(&total)
	if err != nil {
		return 0
	}
	return total
}

func init() {
	session.Register("mysql", mysqlpder)
}

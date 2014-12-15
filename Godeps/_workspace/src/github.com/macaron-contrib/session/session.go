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

// Package session a middleware that provides the session manager of Macaron.
package session

// NOTE: last sync fc6b9ce on Nov 4, 2014.

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/Unknwon/macaron"
)

func Version() string {
	return "0.0.5"
}

type RawStore interface {
	Set(key, value interface{}) error     //set session value
	Get(key interface{}) interface{}      //get session value
	Delete(key interface{}) error         //delete session value
	SessionID() string                    //back current sessionID
	SessionRelease(w http.ResponseWriter) // release the resource & save data to provider & return the data
	Flush() error                         //delete all data
}

// Store contains all data for one session process with specific id.
type Store interface {
	RawStore
	GetActiveSession() int
}

type Options struct {
	// Name of provider. Default is memory.
	Provider string
	// Provider configuration string.
	Config
}

func prepareOptions(options []Options) Options {
	var opt Options
	if len(options) > 0 {
		opt = options[0]
	}

	// Defaults
	if len(opt.Provider) == 0 {
		opt.Provider = "memory"
	}
	opt.EnableSetCookie = true
	if len(opt.CookieName) == 0 {
		opt.CookieName = "MacaronSession"
	}
	if len(opt.CookiePath) == 0 {
		opt.CookiePath = "/"
	}
	if opt.Gclifetime == 0 {
		opt.Gclifetime = 3600
	}
	if opt.Maxlifetime == 0 {
		opt.Maxlifetime = opt.Gclifetime
	}

	if opt.SessionIdLength == 0 {
		opt.SessionIdLength = 16
	}

	return opt
}

// ___________.____       _____    _________ ___ ___
// \_   _____/|    |     /  _  \  /   _____//   |   \
//  |    __)  |    |    /  /_\  \ \_____  \/    ~    \
//  |     \   |    |___/    |    \/        \    Y    /
//  \___  /   |_______ \____|__  /_______  /\___|_  /
//      \/            \/       \/        \/       \/

type Flash struct {
	ctx *macaron.Context
	url.Values
	ErrorMsg, WarningMsg, InfoMsg, SuccessMsg string
}

func (f *Flash) set(name, msg string, current ...bool) {
	isShow := false
	if (len(current) == 0 && macaron.FlashNow) ||
		(len(current) > 0 && current[0]) {
		isShow = true
	}

	if isShow {
		f.ctx.Data["Flash"] = f
	} else {
		f.Set(name, msg)
	}
}

func (f *Flash) Error(msg string, current ...bool) {
	f.ErrorMsg = msg
	f.set("error", msg, current...)
}

func (f *Flash) Warning(msg string, current ...bool) {
	f.WarningMsg = msg
	f.set("warning", msg, current...)
}

func (f *Flash) Info(msg string, current ...bool) {
	f.InfoMsg = msg
	f.set("info", msg, current...)
}

func (f *Flash) Success(msg string, current ...bool) {
	f.SuccessMsg = msg
	f.set("success", msg, current...)
}

type store struct {
	RawStore
	*Manager
}

// Sessioner is a middleware that maps a session.SessionStore service into the Macaron handler chain.
// An single variadic session.Options struct can be optionally provided to configure.
func Sessioner(options ...Options) macaron.Handler {
	opt := prepareOptions(options)
	manager, err := NewManager(opt.Provider, &opt.Config)
	if err != nil {
		panic(err)
	}
	go manager.GC()

	return func(ctx *macaron.Context) {
		// FIXME: should I panic for error?
		sess, _ := manager.SessionStart(ctx.Resp, ctx.Req.Request)

		// Get flash.
		vals, _ := url.ParseQuery(ctx.GetCookie("macaron_flash"))
		if len(vals) > 0 {
			f := &Flash{Values: vals}
			f.ErrorMsg = f.Get("error")
			f.SuccessMsg = f.Get("success")
			f.InfoMsg = f.Get("info")
			f.WarningMsg = f.Get("warning")
			ctx.Data["Flash"] = f
			ctx.SetCookie("macaron_flash", "", -1, opt.CookiePath)
		}

		f := &Flash{ctx, url.Values{}, "", "", "", ""}
		ctx.Resp.Before(func(macaron.ResponseWriter) {
			sess.SessionRelease(ctx.Resp)

			if flash := f.Encode(); len(flash) > 0 {
				ctx.SetCookie("macaron_flash", flash, 0, opt.CookiePath)
			}
		})

		ctx.Map(f)
		s := store{
			RawStore: sess,
			Manager:  manager,
		}
		ctx.MapTo(s, (*Store)(nil))
	}
}

// Provider contains global session methods and saved SessionStores.
// it can operate a SessionStore by its id.
type Provider interface {
	SessionInit(gclifetime int64, config string) error
	SessionRead(sid string) (RawStore, error)
	SessionExist(sid string) bool
	SessionRegenerate(oldsid, sid string) (RawStore, error)
	SessionDestroy(sid string) error
	SessionAll() int //get all active session
	SessionGC()
}

var provides = make(map[string]Provider)

// Register makes a session provide available by the provided name.
// If Register is called twice with the same name or if driver is nil,
// it panics.
func Register(name string, provide Provider) {
	if provide == nil {
		panic("session: Register provide is nil")
	}
	if _, dup := provides[name]; dup {
		panic("session: Register called twice for provider " + name)
	}
	provides[name] = provide
}

type Config struct {
	CookieName      string `json:"cookieName"`
	CookiePath      string `json:"cookiePath"`
	EnableSetCookie bool   `json:"enableSetCookie,omitempty"`
	Gclifetime      int64  `json:"gclifetime"`
	Maxlifetime     int64  `json:"maxLifetime"`
	Secure          bool   `json:"secure"`
	CookieLifeTime  int    `json:"cookieLifeTime"`
	ProviderConfig  string `json:"providerConfig"`
	Domain          string `json:"domain"`
	SessionIdLength int64  `json:"sessionIdLength"`
}

// Manager contains Provider and its configuration.
type Manager struct {
	provider Provider
	config   *Config
}

// Create new Manager with provider name and json config string.
// provider name:
// 1. cookie
// 2. file
// 3. memory
// 4. redis
// 5. mysql
// json config:
// 1. is https  default false
// 2. hashfunc  default sha1
// 3. hashkey default beegosessionkey
// 4. maxage default is none
func NewManager(provideName string, config *Config) (*Manager, error) {
	provider, ok := provides[provideName]
	if !ok {
		return nil, fmt.Errorf("session: unknown provide %q (forgotten import?)", provideName)
	}

	config.EnableSetCookie = true
	if config.Maxlifetime == 0 {
		config.Maxlifetime = config.Gclifetime
	}
	if err := provider.SessionInit(config.Maxlifetime, config.ProviderConfig); err != nil {
		return nil, err
	}
	return &Manager{
		provider: provider,
		config:   config,
	}, nil
}

// Start session. generate or read the session id from http request.
// if session id exists, return SessionStore with this id.
func (manager *Manager) SessionStart(w http.ResponseWriter, r *http.Request) (session RawStore, _ error) {
	cookie, err := r.Cookie(manager.config.CookieName)
	if err != nil || len(cookie.Value) == 0 {
		sid, err := manager.sessionId(r)
		if err != nil {
			return nil, err
		}
		session, err = manager.provider.SessionRead(sid)
		if err != nil {
			return nil, err
		}

		cookie = &http.Cookie{Name: manager.config.CookieName,
			Value:    url.QueryEscape(sid),
			Path:     manager.config.CookiePath,
			HttpOnly: true,
			Secure:   manager.config.Secure,
			Domain:   manager.config.Domain,
		}
		if manager.config.CookieLifeTime >= 0 {
			cookie.MaxAge = manager.config.CookieLifeTime
		}
		if manager.config.EnableSetCookie {
			http.SetCookie(w, cookie)
		}
		r.AddCookie(cookie)
	} else {
		sid, err := url.QueryUnescape(cookie.Value)
		if err != nil {
			return nil, err
		}

		if manager.provider.SessionExist(sid) {
			session, err = manager.provider.SessionRead(sid)
			if err != nil {
				return nil, err
			}
		} else {
			sid, err = manager.sessionId(r)
			if err != nil {
				return nil, err
			}
			session, err = manager.provider.SessionRead(sid)
			if err != nil {
				return nil, err
			}

			cookie = &http.Cookie{Name: manager.config.CookieName,
				Value:    url.QueryEscape(sid),
				Path:     manager.config.CookiePath,
				HttpOnly: true,
				Secure:   manager.config.Secure,
				Domain:   manager.config.Domain,
			}
			if manager.config.CookieLifeTime >= 0 {
				cookie.MaxAge = manager.config.CookieLifeTime
			}
			if manager.config.EnableSetCookie {
				http.SetCookie(w, cookie)
			}
			r.AddCookie(cookie)
		}
	}
	return session, nil
}

// Destroy session by its id in http request cookie.
func (manager *Manager) SessionDestroy(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(manager.config.CookieName)
	if err != nil || cookie.Value == "" {
		return
	} else {
		manager.provider.SessionDestroy(cookie.Value)
		expiration := time.Now()
		cookie := http.Cookie{Name: manager.config.CookieName,
			Path:     manager.config.CookiePath,
			HttpOnly: true,
			Expires:  expiration,
			MaxAge:   -1}
		http.SetCookie(w, &cookie)
	}
}

// Get SessionStore by its id.
func (manager *Manager) GetSessionStore(sid string) (sessions RawStore, err error) {
	sessions, err = manager.provider.SessionRead(sid)
	return
}

// Start session gc process.
// it can do gc in times after gc lifetime.
func (manager *Manager) GC() {
	manager.provider.SessionGC()
	time.AfterFunc(time.Duration(manager.config.Gclifetime)*time.Second, func() { manager.GC() })
}

// Regenerate a session id for this SessionStore who's id is saving in http request.
func (manager *Manager) SessionRegenerateId(w http.ResponseWriter, r *http.Request) (session RawStore) {
	sid, err := manager.sessionId(r)
	if err != nil {
		return nil
	}

	cookie, err := r.Cookie(manager.config.CookieName)
	if err != nil && cookie.Value == "" {
		// delete old cookie
		session, err = manager.provider.SessionRead(sid)
		if err != nil {
			return nil
		}
		cookie = &http.Cookie{Name: manager.config.CookieName,
			Value:    url.QueryEscape(sid),
			Path:     manager.config.CookiePath,
			HttpOnly: true,
			Secure:   manager.config.Secure,
			Domain:   manager.config.Domain,
		}
	} else {
		oldsid, err := url.QueryUnescape(cookie.Value)
		if err != nil {
			return nil
		}
		session, err = manager.provider.SessionRegenerate(oldsid, sid)
		if err != nil {
			return nil
		}
		cookie.Value = url.QueryEscape(sid)
		cookie.HttpOnly = true
		cookie.Path = "/"
	}
	if manager.config.CookieLifeTime >= 0 {
		cookie.MaxAge = manager.config.CookieLifeTime
	}
	http.SetCookie(w, cookie)
	r.AddCookie(cookie)
	return session
}

// Get all active sessions count number.
func (manager *Manager) GetActiveSession() int {
	return manager.provider.SessionAll()
}

// Set cookie with https.
func (manager *Manager) SetSecure(secure bool) {
	manager.config.Secure = secure
}

// generate session id with rand string, unix nano time, remote addr by hash function.
func (manager *Manager) sessionId(r *http.Request) (string, error) {
	b := make([]byte, manager.config.SessionIdLength)
	n, err := rand.Read(b)
	if n != len(b) || err != nil {
		return "", fmt.Errorf("fail to read from the system CSPRNG.")
	}
	return hex.EncodeToString(b), nil
}

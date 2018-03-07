package middleware

import (
	"math/rand"
	"time"

	"github.com/go-macaron/session"
	_ "github.com/go-macaron/session/memcache"
	_ "github.com/go-macaron/session/mysql"
	_ "github.com/go-macaron/session/postgres"
	_ "github.com/go-macaron/session/redis"
	"github.com/grafana/grafana/pkg/log"
	"gopkg.in/macaron.v1"
)

const (
	SESS_KEY_USERID       = "uid"
	SESS_KEY_OAUTH_STATE  = "state"
	SESS_KEY_APIKEY       = "apikey_id" // used for render requests with api keys
	SESS_KEY_LASTLDAPSYNC = "last_ldap_sync"
)

var sessionManager *session.Manager
var sessionOptions *session.Options
var startSessionGC func()
var getSessionCount func() int
var sessionLogger = log.New("session")

func init() {
	startSessionGC = func() {
		sessionManager.GC()
		sessionLogger.Debug("Session GC")
		time.AfterFunc(time.Duration(sessionOptions.Gclifetime)*time.Second, startSessionGC)
	}
	getSessionCount = func() int {
		return sessionManager.Count()
	}
}

func prepareOptions(opt *session.Options) *session.Options {
	if len(opt.Provider) == 0 {
		opt.Provider = "memory"
	}
	if len(opt.ProviderConfig) == 0 {
		opt.ProviderConfig = "data/sessions"
	}
	if len(opt.CookieName) == 0 {
		opt.CookieName = "grafana_sess"
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
	if opt.IDLength == 0 {
		opt.IDLength = 16
	}

	return opt
}

func Sessioner(options *session.Options) macaron.Handler {
	var err error
	sessionOptions = prepareOptions(options)
	sessionManager, err = session.NewManager(options.Provider, *options)
	if err != nil {
		panic(err)
	}

	// start GC threads after some random seconds
	rndSeconds := 10 + rand.Int63n(180)
	time.AfterFunc(time.Duration(rndSeconds)*time.Second, startSessionGC)

	return func(ctx *Context) {
		ctx.Next()

		if err = ctx.Session.Release(); err != nil {
			panic("session(release): " + err.Error())
		}
	}
}

func GetSession() SessionStore {
	return &SessionWrapper{manager: sessionManager}
}

type SessionStore interface {
	// Set sets value to given key in session.
	Set(interface{}, interface{}) error
	// Get gets value by given key in session.
	Get(interface{}) interface{}
	// Delete deletes a key from session.
	Delete(interface{}) interface{}
	// ID returns current session ID.
	ID() string
	// Release releases session resource and save data to provider.
	Release() error
	// Destory deletes a session.
	Destory(*Context) error
	// init
	Start(*Context) error
	// RegenerateId regenerates the session id
	RegenerateId(*Context) error
}

type SessionWrapper struct {
	session session.RawStore
	manager *session.Manager
}

func (s *SessionWrapper) Start(c *Context) error {
	var err error
	s.session, err = s.manager.Start(c.Context)
	return err
}

func (s *SessionWrapper) RegenerateId(c *Context) error {
	var err error
	s.session, err = s.manager.RegenerateId(c.Context)
	return err
}

func (s *SessionWrapper) Set(k interface{}, v interface{}) error {
	if s.session != nil {
		return s.session.Set(k, v)
	}
	return nil
}

func (s *SessionWrapper) Get(k interface{}) interface{} {
	if s.session != nil {
		return s.session.Get(k)
	}
	return nil
}

func (s *SessionWrapper) Delete(k interface{}) interface{} {
	if s.session != nil {
		return s.session.Delete(k)
	}
	return nil
}

func (s *SessionWrapper) ID() string {
	if s.session != nil {
		return s.session.ID()
	}
	return ""
}

func (s *SessionWrapper) Release() error {
	if s.session != nil {
		return s.session.Release()
	}
	return nil
}

func (s *SessionWrapper) Destory(c *Context) error {
	if s.session != nil {
		if err := s.manager.Destory(c.Context); err != nil {
			return err
		}
		s.session = nil
	}
	return nil
}

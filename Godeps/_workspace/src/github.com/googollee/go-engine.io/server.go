package engineio

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"github.com/googollee/go-engine.io/polling"
	"github.com/googollee/go-engine.io/websocket"
	"net/http"
	"sync/atomic"
	"time"
)

type config struct {
	PingTimeout   time.Duration
	PingInterval  time.Duration
	MaxConnection int
	AllowRequest  func(*http.Request) error
	AllowUpgrades bool
	Cookie        string
	NewId         func(r *http.Request) string
}

// Server is the server of engine.io.
type Server struct {
	config            config
	socketChan        chan Conn
	serverSessions    Sessions
	creaters          transportCreaters
	currentConnection int32
}

// NewServer returns the server suppported given transports. If transports is nil, server will use ["polling", "websocket"] as default.
func NewServer(transports []string) (*Server, error) {
	if transports == nil {
		transports = []string{"polling", "websocket"}
	}
	creaters := make(transportCreaters)
	for _, t := range transports {
		switch t {
		case "polling":
			creaters[t] = polling.Creater
		case "websocket":
			creaters[t] = websocket.Creater
		default:
			return nil, InvalidError
		}
	}
	return &Server{
		config: config{
			PingTimeout:   60000 * time.Millisecond,
			PingInterval:  25000 * time.Millisecond,
			MaxConnection: 1000,
			AllowRequest:  func(*http.Request) error { return nil },
			AllowUpgrades: true,
			Cookie:        "io",
			NewId:         newId,
		},
		socketChan:     make(chan Conn),
		serverSessions: newServerSessions(),
		creaters:       creaters,
	}, nil
}

// SetPingTimeout sets the timeout of ping. When time out, server will close connection. Default is 60s.
func (s *Server) SetPingTimeout(t time.Duration) {
	s.config.PingTimeout = t
}

// SetPingInterval sets the interval of ping. Default is 25s.
func (s *Server) SetPingInterval(t time.Duration) {
	s.config.PingInterval = t
}

// SetMaxConnection sets the max connetion. Default is 1000.
func (s *Server) SetMaxConnection(n int) {
	s.config.MaxConnection = n
}

// SetAllowRequest sets the middleware function when establish connection. If it return non-nil, connection won't be established. Default will allow all request.
func (s *Server) SetAllowRequest(f func(*http.Request) error) {
	s.config.AllowRequest = f
}

// SetAllowUpgrades sets whether server allows transport upgrade. Default is true.
func (s *Server) SetAllowUpgrades(allow bool) {
	s.config.AllowUpgrades = allow
}

// SetCookie sets the name of cookie which used by engine.io. Default is "io".
func (s *Server) SetCookie(prefix string) {
	s.config.Cookie = prefix
}

// SetNewId sets the callback func to generate new connection id. By default, id is generated from remote addr + current time stamp
func (s *Server) SetNewId(f func(*http.Request) string) {
	s.config.NewId = f
}

// SetSessionManager sets the sessions as server's session manager. Default sessions is single process manager. You can custom it as load balance.
func (s *Server) SetSessionManager(sessions Sessions) {
	s.serverSessions = sessions
}

// ServeHTTP handles http request.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	cookies := r.Cookies()
	sid := r.URL.Query().Get("sid")
	conn := s.serverSessions.Get(sid)
	if conn == nil {
		if sid != "" {
			http.Error(w, "invalid sid", http.StatusBadRequest)
			return
		}

		if err := s.config.AllowRequest(r); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		n := atomic.AddInt32(&s.currentConnection, 1)
		if int(n) > s.config.MaxConnection {
			http.Error(w, "too many connections", http.StatusServiceUnavailable)
			return
		}

		sid = s.config.NewId(r)

		var err error
		conn, err = newServerConn(sid, w, r, s)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		s.serverSessions.Set(sid, conn)
		cookies = append(cookies, &http.Cookie{
			Name:  s.config.Cookie,
			Value: sid,
		})

		s.socketChan <- conn
	}
	for _, c := range cookies {
		w.Header().Set("Set-Cookie", c.String())
	}
	conn.(*serverConn).ServeHTTP(w, r)
}

// Accept returns Conn when client connect to server.
func (s *Server) Accept() (Conn, error) {
	return <-s.socketChan, nil
}

func (s *Server) configure() config {
	return s.config
}

func (s *Server) transports() transportCreaters {
	return s.creaters
}

func (s *Server) onClose(id string) {
	s.serverSessions.Remove(id)
	atomic.AddInt32(&s.currentConnection, -1)
}

func newId(r *http.Request) string {
	hash := fmt.Sprintf("%s %s", r.RemoteAddr, time.Now())
	buf := bytes.NewBuffer(nil)
	sum := md5.Sum([]byte(hash))
	encoder := base64.NewEncoder(base64.URLEncoding, buf)
	encoder.Write(sum[:])
	encoder.Close()
	return buf.String()[:20]
}

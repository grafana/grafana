package nats

import (
	"fmt"
	"net/url"
	"strings"
	"sync"

	"github.com/go-kit/log/level"
	natsserver "github.com/nats-io/nats-server/v2/server"

	"github.com/grafana/grafana/pkg/infra/log"
)

// serverLogger forwards embedded server warnings and errors, such as rejected
// route handshakes, to the Grafana logger and drops the chattier levels.
type serverLogger struct {
	log log.Logger
	// nats-server formats route URLs with their userinfo in some messages, so
	// route passwords are masked before anything is logged.
	secrets *routeSecrets
}

var _ natsserver.Logger = serverLogger{}

func newServerLogger(l log.Logger, secrets *routeSecrets) serverLogger {
	return serverLogger{log: l, secrets: secrets}
}

// routeSecrets are the route passwords this process has used. The route
// credential joins the placeholder when it loads after startup.
type routeSecrets struct {
	mu        sync.RWMutex
	passwords []string
}

func (r *routeSecrets) add(creds *url.Userinfo) {
	if r == nil || creds == nil {
		return
	}
	password, _ := creds.Password()
	r.mu.Lock()
	defer r.mu.Unlock()
	r.passwords = append(r.passwords, password)
}

func (r *routeSecrets) mask(msg string) string {
	if r == nil {
		return msg
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.passwords {
		if p != "" {
			msg = strings.ReplaceAll(msg, p, "xxxxx")
		}
	}
	return msg
}

func (l serverLogger) Noticef(string, ...any) {}
func (l serverLogger) Debugf(string, ...any)  {}
func (l serverLogger) Tracef(string, ...any)  {}

func (l serverLogger) Warnf(format string, v ...any) {
	l.write(level.WarnValue(), format, v)
}

func (l serverLogger) Errorf(format string, v ...any) {
	l.write(level.ErrorValue(), format, v)
}

// Fatalf must not exit: the embedded server shares the Grafana process.
func (l serverLogger) Fatalf(format string, v ...any) {
	l.write(level.ErrorValue(), format, v)
}

// write passes the message unformatted, so it is only formatted, and its route
// password masked, if the log level lets the record through.
func (l serverLogger) write(lvl level.Value, format string, args []any) {
	_ = l.log.Log(level.Key(), lvl, "msg", serverMessage{format: format, args: args, secrets: l.secrets})
}

// serverMessage formats an embedded server log message when it is written.
type serverMessage struct {
	format  string
	args    []any
	secrets *routeSecrets
}

func (m serverMessage) String() string {
	return m.secrets.mask(fmt.Sprintf(m.format, m.args...))
}

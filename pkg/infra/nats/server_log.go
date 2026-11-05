package nats

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/go-kit/log/level"
	natsserver "github.com/nats-io/nats-server/v2/server"

	"github.com/grafana/grafana/pkg/infra/log"
)

// serverLogger forwards embedded server warnings and errors, such as rejected
// route handshakes, to the Grafana logger and drops the chattier levels.
type serverLogger struct {
	log log.Logger
	// secret is the route password. nats-server formats route URLs with their
	// userinfo in some messages, so it is masked before anything is logged.
	secret string
}

var _ natsserver.Logger = serverLogger{}

func newServerLogger(l log.Logger, routeAuth *url.Userinfo) serverLogger {
	logger := serverLogger{log: l}
	if routeAuth != nil {
		logger.secret, _ = routeAuth.Password()
	}
	return logger
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
	_ = l.log.Log(level.Key(), lvl, "msg", serverMessage{format: format, args: args, secret: l.secret})
}

// serverMessage formats an embedded server log message when it is written.
type serverMessage struct {
	format string
	args   []any
	secret string
}

func (m serverMessage) String() string {
	msg := fmt.Sprintf(m.format, m.args...)
	if m.secret == "" {
		return msg
	}
	return strings.ReplaceAll(msg, m.secret, "xxxxx")
}

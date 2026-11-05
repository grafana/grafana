package nats

import (
	"fmt"

	natsserver "github.com/nats-io/nats-server/v2/server"

	"github.com/grafana/grafana/pkg/infra/log"
)

// serverLogger forwards embedded server warnings and errors, such as rejected
// route handshakes, to the Grafana logger and drops the chattier levels.
type serverLogger struct {
	log log.Logger
}

var _ natsserver.Logger = serverLogger{}

func (l serverLogger) Noticef(string, ...any) {}
func (l serverLogger) Debugf(string, ...any)  {}
func (l serverLogger) Tracef(string, ...any)  {}

func (l serverLogger) Warnf(format string, v ...any) {
	l.log.Warn(fmt.Sprintf(format, v...))
}

func (l serverLogger) Errorf(format string, v ...any) {
	l.log.Error(fmt.Sprintf(format, v...))
}

// Fatalf must not exit: the embedded server shares the Grafana process.
func (l serverLogger) Fatalf(format string, v ...any) {
	l.log.Error(fmt.Sprintf(format, v...))
}

package systemd

import (
	"net"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
)

// NotifyReady sends READY state notifications to systemd.
func NotifyReady(log log.Logger) {
	notify(log, "READY=1")
}

// notify sends state notifications to systemd.
func notify(log log.Logger, state string) {
	notifySocket := os.Getenv("NOTIFY_SOCKET")
	if notifySocket == "" {
		log.Debug(
			"NOTIFY_SOCKET environment variable empty or unset, can't send systemd notification")
		return
	}

	socketAddr := &net.UnixAddr{
		Name: notifySocket,
		Net:  "unixgram",
	}
	conn, err := net.DialUnix(socketAddr.Net, nil, socketAddr)
	if err != nil {
		log.Warn("Failed to connect to systemd", "err", err, "socket", notifySocket)
		return
	}
	defer func() {
		if err = conn.Close(); err != nil {
			log.Warn("Failed to close connection", "err", err)
		}
	}()

	_, err = conn.Write([]byte(state))
	if err != nil {
		log.Warn("Failed to write notification to systemd", "err", err)
	}
}

package util

import (
	"errors"
	"net"
	"os"
)

var NoNotifySocket = errors.New("NOTIFY_SOCKET environment variable empty or unset.")

func SdNotify(state string) error {
	notifySocket := os.Getenv("NOTIFY_SOCKET")

	if notifySocket == "" {
		return NoNotifySocket
	}

	socketAddr := &net.UnixAddr{
		Name: notifySocket,
		Net:  "unixgram",
	}

	conn, err := net.DialUnix(socketAddr.Net, nil, socketAddr)

	if err != nil {
		return err
	}

	_, err = conn.Write([]byte(state))

	conn.Close()

	return err
}

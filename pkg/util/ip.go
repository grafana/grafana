package util

import (
	"net"
)

// SplitIPPort splits the ip string and port.
func SplitIPPort(ipStr string, portDefault string) (ip string, port string, err error) {
	ipAddr := net.ParseIP(ipStr)

	if ipAddr == nil {
		// Port was included
		ip, port, err = net.SplitHostPort(ipStr)

		if err != nil {
			return "", "", err
		}
	} else {
		// No port was included
		ip = ipAddr.String()
		port = portDefault
	}

	return ip, port, nil
}

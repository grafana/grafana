package network

import (
	"fmt"
	"net"
	"regexp"
)

var reIPv4AndPort = regexp.MustCompile(`^(\d+\.\d+\.\d+\.\d+):\d+$`)
var reIPv6AndPort = regexp.MustCompile(`^\[(.+)\]:\d+$`)

// GetIPFromAddress tries to get an IPv4 or IPv6 address from a host address, potentially including a port.
func GetIPFromAddress(input string) (net.IP, error) {
	if a := net.ParseIP(input); len(a) > 0 {
		return a, nil
	}

	err := fmt.Errorf("not a valid IP address or IP address/port pair: %q", input)

	// It could potentially be an IP address/port pair
	var addr string
	ms := reIPv4AndPort.FindStringSubmatch(input)
	if len(ms) == 0 {
		ms := reIPv6AndPort.FindStringSubmatch(input)
		if len(ms) == 0 {
			return nil, err
		}

		addr = ms[1]
	} else {
		// Strip off port
		addr = ms[1]
	}

	if a := net.ParseIP(addr); len(a) > 0 {
		return a, nil
	}

	return nil, err
}

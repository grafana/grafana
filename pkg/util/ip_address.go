package util

import (
	"fmt"
	"net"
	"strings"

	"golang.org/x/xerrors"
)

// ParseIPAddress parses an IP address and removes port and/or IPV6 format
func ParseIPAddress(input string) (string, error) {
	host, _, err := SplitHostPort(input)
	if err != nil {
		return "", xerrors.Errorf("Failed to split network address '%s' by host and port: %w",
			input, err)
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return host, nil
	}

	if ip.IsLoopback() {
		if strings.Contains(host, ":") {
			// IPv6
			return "::1", nil
		}
		return "127.0.0.1", nil
	}

	return ip.String(), nil
}

// SplitHostPortDefault splits ip address/hostname string by host and port. Defaults used if no match found
func SplitHostPortDefault(input, defaultHost, defaultPort string) (host string, port string, err error) {
	if len(input) == 0 {
		return "", "", xerrors.Errorf("Input is empty")
	}

	start := 0
	// Determine if IPv6 address, in which case IP address will be enclosed in square brackets
	if strings.Index(input, "[") == 0 {
		addrEnd := strings.LastIndex(input, "]")
		if addrEnd < 0 {
			// Malformed address
			return "", "", xerrors.Errorf("Malformed IPv6 address: '%s'", input)
		}

		start = addrEnd
	}
	if strings.LastIndex(input[start:], ":") < 0 {
		// There's no port section of the input
		// It's still useful to call net.SplitHostPort though, since it removes IPv6
		// square brackets from the address
		input = fmt.Sprintf("%s:%s", input, defaultPort)
	}

	host, port, err = net.SplitHostPort(input)
	if err != nil {
		return "", "", xerrors.Errorf("net.SplitHostPort failed for '%s': %w", input, err)
	}

	if len(host) == 0 {
		host = defaultHost
	}
	if len(port) == 0 {
		port = defaultPort
	}

	return host, port, nil
}

// SplitHostPort splits ip address/hostname string by host and port
func SplitHostPort(input string) (host string, port string, err error) {
	return SplitHostPortDefault(input, "", "")
}

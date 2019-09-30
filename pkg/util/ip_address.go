package util

import (
	"fmt"
	"net"
	"strings"
)

// ParseIPAddress parses an IP address and removes port and/or IPV6 format
func ParseIPAddress(input string) string {
	host, _ := SplitHostPort(input)

	ip := net.ParseIP(host)
	if ip == nil {
		return host
	}

	if ip.IsLoopback() {
		if strings.Contains(host, ":") {
			// IPv6
			return "::1"
		}
		return "127.0.0.1"
	}

	return ip.String()
}

// SplitHostPortDefault splits ip address/hostname string by host and port. Defaults used if no match found
func SplitHostPortDefault(input, defaultHost, defaultPort string) (host string, port string) {
	start := 0
	// Determine if IPv6 address, in which case IP address will be enclosed in square brackets
	if strings.Index(input, "[") == 0 {
		addrEnd := strings.LastIndex(input, "]")
		if addrEnd < 0 {
			// Malformed address
			return defaultHost, defaultPort
		}

		start = addrEnd
	}
	if strings.LastIndex(input[start:], ":") < 0 {
		// There's no port section of the input
		// It's still useful to call net.SplitHostPort though, since it removes IPv6
		// square brackets from the address
		input = fmt.Sprintf("%s:%s", input, defaultPort)
	}

	host, port, err := net.SplitHostPort(input)
	if err != nil {
		panic(fmt.Sprintf("net.SplitHostPort failed for '%s': %v", input, err))
	}

	if len(host) == 0 {
		host = defaultHost
	}
	if len(port) == 0 {
		port = defaultPort
	}

	return host, port
}

// SplitHostPort splits ip address/hostname string by host and port
func SplitHostPort(input string) (host string, port string) {
	return SplitHostPortDefault(input, "", "")
}

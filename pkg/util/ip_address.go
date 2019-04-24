package util

import (
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
		return "127.0.0.1"
	}

	return ip.String()
}

// SplitHostPortDefault splits ip address/hostname string by host and port. Defaults used if no match found
func SplitHostPortDefault(input, defaultHost, defaultPort string) (host string, port string) {
	port = defaultPort
	s := input
	lastIndex := strings.LastIndex(input, ":")

	if lastIndex != -1 {
		if lastIndex > 0 && input[lastIndex-1:lastIndex] != ":" {
			s = input[:lastIndex]
			port = input[lastIndex+1:]
		} else if lastIndex == 0 {
			s = defaultHost
			port = input[lastIndex+1:]
		}
	} else {
		port = defaultPort
	}

	s = strings.Replace(s, "[", "", -1)
	s = strings.Replace(s, "]", "", -1)
	port = strings.Replace(port, "[", "", -1)
	port = strings.Replace(port, "]", "", -1)

	return s, port
}

// SplitHostPort splits ip address/hostname string by host and port
func SplitHostPort(input string) (host string, port string) {
	return SplitHostPortDefault(input, "", "")
}

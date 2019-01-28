package util

import (
	"net"
	"strings"
)

// ParseIPAddress parses an IP address and removes port and/or IPV6 format
func ParseIPAddress(input string) string {
	s := input
	lastIndex := strings.LastIndex(input, ":")

	if lastIndex != -1 {
		if lastIndex > 0 && input[lastIndex-1:lastIndex] != ":" {
			s = input[:lastIndex]
		}
	}

	s = strings.Replace(s, "[", "", -1)
	s = strings.Replace(s, "]", "", -1)

	ip := net.ParseIP(s)

	if ip.IsLoopback() {
		return "127.0.0.1"
	}

	return ip.String()
}

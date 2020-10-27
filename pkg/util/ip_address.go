package util

import (
	"fmt"
	"net"
	"strings"

	"github.com/grafana/grafana/pkg/util/errutil"
)

// ParseIPAddress parses an IP address and removes port and/or IPV6 format
func ParseIPAddress(input string) (string, error) {
	addr, err := SplitHostPort(input)
	if err != nil {
		return "", errutil.Wrapf(err, "failed to split network address %q by host and port",
			input)
	}

	ip := net.ParseIP(addr.Host)
	if ip == nil {
		return addr.Host, nil
	}

	if ip.IsLoopback() {
		if strings.Contains(addr.Host, ":") {
			// IPv6
			return "::1", nil
		}
		return "127.0.0.1", nil
	}

	return ip.String(), nil
}

type NetworkAddress struct {
	Host string
	Port string
}

// SplitHostPortDefault splits ip address/hostname string by host and port. Defaults used if no match found
func SplitHostPortDefault(input, defaultHost, defaultPort string) (NetworkAddress, error) {
	addr := NetworkAddress{
		Host: defaultHost,
		Port: defaultPort,
	}

	if len(input) == 0 {
		return addr, nil
	}

	// validate brackets for IPv6
	hasLeftBracket := strings.Index(input, "[") == 0
	hasRightBracket := strings.Contains(input, "]")
	if (hasLeftBracket && !hasRightBracket) || (!hasLeftBracket && hasRightBracket) {
		return addr, fmt.Errorf("Malformed IPv6 address: '%s'", input)
	}

	// add port and brackets to IPv6
	isIPv6WithoutBracketsAndPort := (strings.Count(input, ":") > 1) && !hasRightBracket
	if isIPv6WithoutBracketsAndPort {
		input = fmt.Sprintf("[%s]:%s", input, defaultPort)
	}

	// add port to IPv4/IPv6 with brackets
	isIPv4WithoutPort := strings.Contains(input, ".") && !strings.Contains(input, ":")
	isIPv6WithBracketsAndWithoutPort := hasLeftBracket && (strings.LastIndex(input, "]") == len(input)-1)
	if isIPv4WithoutPort || isIPv6WithBracketsAndWithoutPort {
		input = fmt.Sprintf("%s:%s", input, defaultPort)
	}

	host, port, err := net.SplitHostPort(input)
	if err != nil {
		return addr, errutil.Wrapf(err, "net.SplitHostPort failed for '%s'", input)
	}

	// use host/port from input if a non-empty host/port as input
	if len(host) > 0 {
		addr.Host = host
	}
	if len(port) > 0 {
		addr.Port = port
	}

	return addr, nil
}

// SplitHostPort splits ip address/hostname string by host and port
func SplitHostPort(input string) (NetworkAddress, error) {
	if len(input) == 0 {
		return NetworkAddress{}, fmt.Errorf("Input is empty")
	}
	return SplitHostPortDefault(input, "", "")
}

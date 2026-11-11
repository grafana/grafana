package util

import (
	"errors"
	"fmt"
	"net"
	"net/netip"
	"strings"
)

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

	start := 0
	// Determine if IPv6 address, in which case IP address will be enclosed in square brackets
	if strings.Index(input, "[") == 0 {
		addrEnd := strings.LastIndex(input, "]")
		if addrEnd < 0 {
			// Malformed address
			return addr, fmt.Errorf("malformed IPv6 address: '%s'", input)
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
		return addr, fmt.Errorf("net.SplitHostPort failed for '%s': %w", input, err)
	}

	if len(host) > 0 {
		addr.Host = host
	}
	if len(port) > 0 {
		addr.Port = port
	}

	return addr, nil
}

var ErrZonedAddress = errors.New("zoned addresses are not supported")

// ParseIPOrCIDR parses an IP address or CIDR, optionally in one pair of square brackets, into a masked prefix.
func ParseIPOrCIDR(entry string) (netip.Prefix, error) {
	if len(entry) > 1 && strings.HasPrefix(entry, "[") && strings.HasSuffix(entry, "]") {
		entry = entry[1 : len(entry)-1]
	}

	if strings.Contains(entry, "/") {
		prefix, err := netip.ParsePrefix(entry)
		if err != nil {
			return netip.Prefix{}, err
		}
		if prefix.Addr().Is4In6() {
			if prefix.Bits() < 96 {
				return netip.Prefix{}, errors.New("IPv4-mapped prefix must be at least /96")
			}
			prefix = netip.PrefixFrom(prefix.Addr().Unmap(), prefix.Bits()-96)
		}
		return prefix.Masked(), nil
	}

	addr, err := netip.ParseAddr(entry)
	if err != nil {
		return netip.Prefix{}, err
	}
	if addr.Zone() != "" {
		return netip.Prefix{}, ErrZonedAddress
	}
	addr = addr.Unmap()
	return netip.PrefixFrom(addr, addr.BitLen()), nil
}

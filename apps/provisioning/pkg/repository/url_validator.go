package repository

import (
	context "context"
	"fmt"
	"net"
	"net/url"
)

type ipAddressResolver func(ctx context.Context, host string) ([]net.IPAddr, error)

type URLValidator struct {
	allowlist         Allowlist
	ipAddressResolver ipAddressResolver
}

func NewURLValidator(allowlist Allowlist, ipAddressResolver ipAddressResolver) *URLValidator {
	return &URLValidator{
		allowlist:         allowlist,
		ipAddressResolver: ipAddressResolver,
	}
}

func (v *URLValidator) ValidateURL(
	ctx context.Context,
	rawURL string,
) error {
	host, err := urlHostname(rawURL)
	if err != nil {
		return err
	}

	if v.allowlist.AllowsHost(host) {
		return nil
	}

	if ip := net.ParseIP(host); ip != nil {
		return validateHostIP(host, ip, v.allowlist)
	}

	addrs, err := v.ipAddressResolver(ctx, host)
	if err != nil {
		return fmt.Errorf("resolve URL host %q: %w", host, err)
	}
	if len(addrs) == 0 {
		return fmt.Errorf("URL host %q did not resolve to any IP addresses", host)
	}

	for _, addr := range addrs {
		if err := validateHostIP(host, addr.IP, v.allowlist); err != nil {
			return err
		}
	}
	return nil
}

func urlHostname(rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	return normalizeHost(parsed.Hostname(), rawURL)
}

func validateHostIP(host string, ip net.IP, allowlist Allowlist) error {
	if isBlockedIP(ip) && !allowlist.AllowsIP(ip) {
		return fmt.Errorf("URL host %q resolves to blocked IP %s", host, ip.String())
	}
	return nil
}

func isBlockedIP(ip net.IP) bool {
	return ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsUnspecified()
}

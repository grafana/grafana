package repository

import (
	context "context"
	"fmt"
	"net"
	"net/url"
	"syscall"
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

// NewURLValidatorFromAllowlist builds a validator that resolves hosts with the system resolver.
// Entries that cannot be parsed fall back to an empty allowlist, the strictest policy; the
// API server reports the bad configuration at startup.
func NewURLValidatorFromAllowlist(entries []string) *URLValidator {
	allowlist, err := NewAllowlist(entries)
	if err != nil {
		allowlist, _ = NewAllowlist(nil)
	}
	return NewURLValidator(allowlist, net.DefaultResolver.LookupIPAddr)
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

// DialContext wraps dialer so that connections are only made to hosts the validator
// would accept. Hosts on the allowlist are dialed as is; for every other host the
// resolved address is checked right before connecting, which also covers a name that
// resolves differently from when the URL was admitted (DNS rebinding) and redirects.
func (v *URLValidator) DialContext(dialer *net.Dialer) func(ctx context.Context, network, addr string) (net.Conn, error) {
	checked := *dialer
	checked.Control = func(_, address string, _ syscall.RawConn) error {
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return err
		}
		ip := net.ParseIP(host)
		if ip == nil {
			return fmt.Errorf("dial address %q is not an IP address", address)
		}
		return validateHostIP(host, ip, v.allowlist)
	}

	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		if host, _, err := net.SplitHostPort(addr); err == nil && v.allowlist.AllowsHost(host) {
			return dialer.DialContext(ctx, network, addr)
		}
		return checked.DialContext(ctx, network, addr)
	}
}

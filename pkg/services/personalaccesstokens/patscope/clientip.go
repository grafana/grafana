package patscope

import (
	"net"
	"net/http"
	"strings"
)

// TrustedProxies resolves the client IP behind reverse proxies. The zero value
// trusts nothing and always keys on the TCP peer address.
type TrustedProxies struct {
	header string
	nets   []*net.IPNet
}

func ParseTrustedProxies(header string, entries []string) TrustedProxies {
	t := TrustedProxies{header: header}
	for _, e := range entries {
		if !strings.Contains(e, "/") {
			if ip := net.ParseIP(e); ip != nil {
				bits := 8 * len(ip.To16())
				if ip4 := ip.To4(); ip4 != nil {
					ip, bits = ip4, 32
				}
				t.nets = append(t.nets, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
			}
			continue
		}
		if _, n, err := net.ParseCIDR(e); err == nil {
			t.nets = append(t.nets, n)
		}
	}
	return t
}

func (t TrustedProxies) contains(ip net.IP) bool {
	for _, n := range t.nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// ClientIP keys on the TCP peer unless the peer is a trusted proxy. Then the
// forwarded chain is walked from the right and the first address that is not a
// trusted proxy is used, so client-supplied left-hand entries cannot rotate the key.
func ClientIP(r *http.Request, t TrustedProxies) string {
	if r == nil {
		return ""
	}
	peer, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		peer = r.RemoteAddr
	}
	if t.header == "" || len(t.nets) == 0 {
		return peer
	}
	if pip := net.ParseIP(peer); pip == nil || !t.contains(pip) {
		return peer
	}
	var parts []string
	for _, v := range r.Header.Values(t.header) {
		parts = append(parts, strings.Split(v, ",")...)
	}
	for i := len(parts) - 1; i >= 0; i-- {
		ip := net.ParseIP(strings.TrimSpace(parts[i]))
		if ip == nil {
			return peer
		}
		if !t.contains(ip) {
			return ip.String()
		}
	}
	return peer
}

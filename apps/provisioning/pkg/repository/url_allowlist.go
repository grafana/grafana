package repository

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

type Allowlist struct {
	hosts map[string]struct{}
	ips   []net.IP
	cidrs []*net.IPNet
}

func NewAllowlist(entries []string) (Allowlist, error) {
	allowlist := Allowlist{hosts: map[string]struct{}{}}
	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}

		if _, ipNet, err := net.ParseCIDR(entry); err == nil {
			allowlist.cidrs = append(allowlist.cidrs, ipNet)
			continue
		}
		if ip := net.ParseIP(entry); ip != nil {
			allowlist.ips = append(allowlist.ips, ip)
			continue
		}

		host, err := hostFromAllowlistEntry(entry)
		if err != nil {
			return Allowlist{}, err
		}
		if ip := net.ParseIP(host); ip != nil {
			allowlist.ips = append(allowlist.ips, ip)
			continue
		}
		allowlist.hosts[host] = struct{}{}
	}
	return allowlist, nil
}

func (a Allowlist) AllowsHost(host string) bool {
	host, err := normalizeHost(host, host)
	if err != nil {
		return false
	}
	_, ok := a.hosts[host]
	return ok
}

func (a Allowlist) AllowsIP(ip net.IP) bool {
	for _, allowedIP := range a.ips {
		if allowedIP.Equal(ip) {
			return true
		}
	}
	for _, ipNet := range a.cidrs {
		if ipNet.Contains(ip) {
			return true
		}
	}
	return false
}

func hostFromAllowlistEntry(entry string) (string, error) {
	if strings.Contains(entry, "://") {
		parsed, err := url.Parse(entry)
		if err != nil {
			return "", fmt.Errorf("parse private endpoint allowlist entry %q: %w", entry, err)
		}
		return normalizeHost(parsed.Hostname(), entry)
	}

	host, _, err := net.SplitHostPort(entry)
	if err == nil {
		return normalizeHost(host, entry)
	}

	return normalizeHost(strings.Trim(entry, "[]"), entry)
}

func normalizeHost(host, source string) (string, error) {
	host = strings.ToLower(strings.TrimSpace(host))
	host = strings.TrimSuffix(host, ".")
	if host == "" {
		return "", fmt.Errorf("private endpoint allowlist entry %q has an empty host", source)
	}
	return host, nil
}

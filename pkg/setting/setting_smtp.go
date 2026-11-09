package setting

import (
	"errors"
	"fmt"
	"net/netip"
	"regexp"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/ini.v1"
)

type SmtpSettings struct {
	Enabled        bool
	Host           string
	User           string
	Password       string
	CertFile       string
	KeyFile        string
	FromAddress    string
	FromName       string
	EhloIdentity   string
	StartTLSPolicy string
	SkipVerify     bool
	StaticHeaders  map[string]string
	EnableTracing  bool

	SendWelcomeEmailOnSignUp bool
	TemplatesPatterns        []string
	ContentTypes             []string

	HostAllowList SmtpHostList
	HostDenyList  SmtpHostList
}

func (smtp SmtpSettings) HostListsSet() bool {
	return !smtp.HostAllowList.IsEmpty() || !smtp.HostDenyList.IsEmpty()
}

// validates mail headers
var mailHeaderRegex = regexp.MustCompile(`^[A-Z][A-Za-z0-9]*(-[A-Z][A-Za-z0-9]*)*$`)

func (cfg *Cfg) readSmtpSettings() error {
	smtpSetts, err := ReadSmtpSettings(cfg.Raw, cfg.InstanceName)
	if err != nil {
		return err
	}
	cfg.Smtp = smtpSetts
	return nil
}

func ReadSmtpSettings(iniFile *ini.File, instanceName string) (SmtpSettings, error) {
	smtpSection := iniFile.Section("smtp")
	staticHeadersSection := iniFile.Section("smtp.static_headers")
	emails := iniFile.Section("emails")

	smtpSetts := SmtpSettings{}

	smtpSetts.Enabled = smtpSection.Key("enabled").MustBool(false)
	smtpSetts.Host = smtpSection.Key("host").String()
	smtpSetts.User = smtpSection.Key("user").String()
	smtpSetts.Password = smtpSection.Key("password").String()
	smtpSetts.CertFile = smtpSection.Key("cert_file").String()
	smtpSetts.KeyFile = smtpSection.Key("key_file").String()
	smtpSetts.FromAddress = smtpSection.Key("from_address").String()
	smtpSetts.FromName = smtpSection.Key("from_name").String()
	smtpSetts.EhloIdentity = smtpSection.Key("ehlo_identity").String()
	if smtpSetts.EhloIdentity == "" {
		smtpSetts.EhloIdentity = instanceName
	}
	smtpSetts.StartTLSPolicy = smtpSection.Key("startTLS_policy").String()
	smtpSetts.SkipVerify = smtpSection.Key("skip_verify").MustBool(false)

	smtpSetts.SendWelcomeEmailOnSignUp = emails.Key("welcome_email_on_sign_up").MustBool(false)
	smtpSetts.TemplatesPatterns = util.SplitString(emails.Key("templates_pattern").MustString("emails/*.html, emails/*.txt"))
	smtpSetts.ContentTypes = util.SplitString(emails.Key("content_types").MustString("text/html"))

	// populate static headers
	staticHeaders, err := readGrafanaSmtpStaticHeaders(staticHeadersSection)
	if err != nil {
		return SmtpSettings{}, err
	}
	smtpSetts.StaticHeaders = staticHeaders
	smtpSetts.EnableTracing = smtpSection.Key("enable_tracing").MustBool(false)

	securitySection := iniFile.Section("security.smtp")
	smtpSetts.HostAllowList, err = parseSmtpHostList("host_allow_list", securitySection.Key("host_allow_list").String())
	if err != nil {
		return SmtpSettings{}, err
	}
	smtpSetts.HostDenyList, err = parseSmtpHostList("host_deny_list", securitySection.Key("host_deny_list").String())
	if err != nil {
		return SmtpSettings{}, err
	}
	return smtpSetts, nil
}

func parseSmtpHostList(key string, value string) (SmtpHostList, error) {
	// A malformed value must be an error: util.SplitString would return an empty
	// list and silently disable the check.
	entries, err := util.SplitStringWithError(value)
	if err != nil {
		return SmtpHostList{}, fmt.Errorf("invalid [security.smtp] %s: %w", key, err)
	}

	var list SmtpHostList
	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		prefix, hostname, err := parseSmtpHostEntry(entry)
		if err != nil {
			return SmtpHostList{}, fmt.Errorf("invalid entry %q in [security.smtp] %s: %w", entry, key, err)
		}
		if prefix.IsValid() {
			list.Prefixes = append(list.Prefixes, prefix)
		} else {
			list.Hostnames = append(list.Hostnames, hostname)
		}
	}
	return list, nil
}

// parseSmtpHostEntry parses a trimmed entry. It returns a valid prefix for an
// IP or CIDR entry, otherwise a normalized hostname, or why the entry is invalid.
func parseSmtpHostEntry(entry string) (netip.Prefix, string, error) {
	if entry == "" {
		return netip.Prefix{}, "", errors.New("entry is empty")
	}

	ipText := entry
	if len(entry) > 1 && strings.HasPrefix(entry, "[") && strings.HasSuffix(entry, "]") {
		ipText = entry[1 : len(entry)-1]
	}

	if strings.Contains(ipText, "/") {
		prefix, err := netip.ParsePrefix(ipText)
		if err != nil {
			return netip.Prefix{}, "", err
		}
		if prefix.Addr().Is4In6() {
			if prefix.Bits() < 96 {
				return netip.Prefix{}, "", errors.New("IPv4-mapped prefix must be at least /96")
			}
			prefix = netip.PrefixFrom(prefix.Addr().Unmap(), prefix.Bits()-96)
		}
		return prefix.Masked(), "", nil
	}
	if addr, err := netip.ParseAddr(ipText); err == nil {
		if addr.Zone() != "" {
			return netip.Prefix{}, "", errors.New("zoned addresses are not supported")
		}
		addr = addr.Unmap()
		return netip.PrefixFrom(addr, addr.BitLen()), "", nil
	}

	hostname := NormalizeSmtpHostname(entry)
	if !validSmtpHostname(hostname) {
		return netip.Prefix{}, "", errors.New("not a valid IP address, CIDR or hostname")
	}
	return netip.Prefix{}, hostname, nil
}

// Dot-separated labels of 1-63 characters that don't start or end with '-'.
var smtpHostnameRegex = regexp.MustCompile(`^([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$`)

// A numeric last label is a malformed IPv4 address such as 010.0.0.1, which
// would otherwise never match anything.
var numericLastLabelRegex = regexp.MustCompile(`(^|\.)[0-9]+$`)

// validSmtpHostname reports whether a normalized hostname is a plausible DNS name.
func validSmtpHostname(hostname string) bool {
	return len(hostname) <= 253 && smtpHostnameRegex.MatchString(hostname) && !numericLastLabelRegex.MatchString(hostname)
}

func validHeader(header string) bool {
	return mailHeaderRegex.MatchString(header)
}

func readGrafanaSmtpStaticHeaders(staticHeadersSection *ini.Section) (map[string]string, error) {
	keys := staticHeadersSection.Keys()
	staticHeaders := make(map[string]string, len(keys))
	for _, key := range keys {
		if !validHeader(key.Name()) {
			return nil, fmt.Errorf("header %q in [smtp.static_headers] configuration: must follow canonical MIME form", key.Name())
		}
		staticHeaders[key.Name()] = key.Value()
	}

	return staticHeaders, nil
}

// SmtpHostList holds the entries of a [security.smtp] host list. Hostnames are
// normalized with NormalizeSmtpHostname and are never resolved.
type SmtpHostList struct {
	Hostnames []string
	Prefixes  []netip.Prefix
}

func (list SmtpHostList) IsEmpty() bool {
	return len(list.Hostnames) == 0 && len(list.Prefixes) == 0
}

func (list SmtpHostList) MatchesHost(hostname string) bool {
	return slices.Contains(list.Hostnames, NormalizeSmtpHostname(hostname))
}

// MatchesAddr reports whether addr is in any prefix. IPv4-mapped IPv6
// addresses are compared as IPv4, and the zone is dropped because
// netip.Prefix.Contains never matches a zoned address.
func (list SmtpHostList) MatchesAddr(addr netip.Addr) bool {
	addr = addr.Unmap().WithZone("")
	return slices.ContainsFunc(list.Prefixes, func(prefix netip.Prefix) bool {
		return prefix.Contains(addr)
	})
}

// NormalizeSmtpHostname lowercases the host and removes brackets and a trailing dot.
func NormalizeSmtpHostname(host string) string {
	host = strings.TrimSuffix(strings.Trim(strings.TrimSpace(host), "[]"), ".")
	return strings.ToLower(host)
}

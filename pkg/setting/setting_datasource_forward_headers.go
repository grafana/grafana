package setting

import (
	"fmt"
	"slices"
	"strings"

	"gopkg.in/ini.v1"
)

// DefaultDataSourceForwardHeadersDenyList is the built-in deny-list that
// applies when [datasource_forward_headers] deny_list_mode is "merge" (the
// default) or when the operator does not override deny_list. It covers
// headers whose value Grafana itself sets (auth, tracing, forwarding
// metadata), hop-by-hop headers per RFC 9110, and headers whose value is
// controlled by the transport (Host, Content-Length, ...).
//
// Names use the same keepCookies-style syntax as the per-datasource
// allow-list: exact match, "prefix[]" for prefix, "[]" for match-all.
//
// This deny-list only stops ForwardHeadersMiddleware copying a header from
// the incoming client HTTP request onto the plugin request (and from there
// onto the datasource's outbound HTTP request via the SDK HTTP client).
// Other features may still send some of these headers downstream by their
// own means — for example Grafana sets its own Authorization/X-ID-Token for
// configured datasource auth, injects X-Grafana-* and tracing metadata, and
// the access=proxy path forwards incoming headers verbatim. Listing a header
// here is not a guarantee that it never reaches the datasource.
var DefaultDataSourceForwardHeadersDenyList = []string{
	// Auth / identity headers Grafana manages.
	"Authorization",
	"Proxy-Authorization",
	"Cookie",
	"Set-Cookie",
	"X-ID-Token",
	// Grafana-injected metadata Grafana owns.
	"X-Grafana-[]",
	"X-Datasource-Uid",
	"X-Dashboard-Uid",
	"X-Dashboard-Title",
	"X-Panel-Id",
	"X-Panel-Plugin-Id",
	"X-Panel-Title",
	"X-Query-Group-Id",
	"X-DS-Authorization",
	// Reverse-proxy metadata Grafana owns / must not be spoofed downstream.
	"X-Forwarded-[]",
	"X-Real-Ip",
	"Forwarded",
	"Via",
	// Hop-by-hop headers (RFC 9110 7.6.1) and transport-controlled headers.
	"Host",
	"Connection",
	"Keep-Alive",
	"Proxy-Connection",
	"TE",
	"Trailer",
	"Transfer-Encoding",
	"Upgrade",
	"Content-Length",
}

func readDataSourceForwardHeadersSettings(iniFile *ini.File, cfg *Cfg) error {
	sec := iniFile.Section("datasource_forward_headers")
	mode := strings.ToLower(strings.TrimSpace(sec.Key("deny_list_mode").MustString("merge")))
	if mode != "merge" && mode != "replace" {
		return fmt.Errorf("invalid [datasource_forward_headers] deny_list_mode %q, expected \"merge\" or \"replace\"", mode)
	}
	cfg.DataSourceForwardHeadersDenyListMode = mode

	rawList := sec.Key("deny_list").String()
	configured := splitCommaList(rawList)

	// Preserve the special "[]" match-all kill switch regardless of mode.
	hasKillSwitch := slices.Contains(configured, "[]")

	switch {
	case hasKillSwitch:
		cfg.DataSourceForwardHeadersDenyList = []string{"[]"}
	case mode == "replace" && rawList != "":
		cfg.DataSourceForwardHeadersDenyList = configured
	default:
		merged := make([]string, 0, len(DefaultDataSourceForwardHeadersDenyList)+len(configured))
		merged = append(merged, DefaultDataSourceForwardHeadersDenyList...)
		merged = append(merged, configured...)
		cfg.DataSourceForwardHeadersDenyList = merged
	}
	return nil
}

func splitCommaList(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

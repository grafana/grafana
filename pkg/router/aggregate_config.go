package router

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

// aggregateTargetConfig is a named upstream apiserver whose API groups the
// router discovers by polling.
type aggregateTargetConfig struct {
	Name         string
	PollInterval time.Duration
	URL          string
	Audience     string
	// DiscoveryAuth is how the router authenticates its own discovery polls:
	// discoveryAuthCAPToken (also the empty default) or discoveryAuthNone.
	// Proxied requests always carry the caller's credentials regardless.
	DiscoveryAuth string
	GroupPatterns []string
	// InternalGroups names the discovered groups that only internal callers
	// may reach or discover. Empty means none.
	InternalGroups     []string
	CAFile             string
	InsecureSkipVerify bool
}

const aggregateSectionPrefix = "router.aggregate."

// Values of a target's discovery_auth key. Unset means discoveryAuthCAPToken.
const (
	discoveryAuthCAPToken = "cap_token"
	discoveryAuthNone     = "none"
)

// Section order determines priority when targets discover the same group.
func parseAggregateTargets(cfg *setting.Cfg) ([]aggregateTargetConfig, error) {
	var targets []aggregateTargetConfig
	for _, raw := range cfg.Raw.Sections() {
		name, ok := strings.CutPrefix(raw.Name(), aggregateSectionPrefix)
		if !ok {
			continue
		}
		if name == "" {
			return nil, fmt.Errorf("%s: target name is required", raw.Name())
		}
		section := cfg.SectionWithEnvOverrides(raw.Name())
		url := section.Key("url").MustString("")
		if url == "" {
			continue
		}
		interval := defaultAggregatePollInterval
		if value := section.Key("poll_interval").String(); value != "" {
			var err error
			interval, err = time.ParseDuration(value)
			if err != nil || interval <= 0 {
				return nil, fmt.Errorf("%s: poll_interval must be a positive duration, got %q", raw.Name(), value)
			}
		}
		audience := section.Key("audience").MustString("")
		discoveryAuth := section.Key("discovery_auth").MustString("")
		switch discoveryAuth {
		case "", discoveryAuthCAPToken:
		case discoveryAuthNone:
			if audience != "" {
				return nil, fmt.Errorf("%s: audience must not be set when discovery_auth is %q", raw.Name(), discoveryAuthNone)
			}
		default:
			return nil, fmt.Errorf("%s: discovery_auth must be %q or %q, got %q", raw.Name(), discoveryAuthCAPToken, discoveryAuthNone, discoveryAuth)
		}
		targets = append(targets, aggregateTargetConfig{
			Name:               name,
			URL:                url,
			PollInterval:       interval,
			Audience:           audience,
			DiscoveryAuth:      discoveryAuth,
			GroupPatterns:      splitGroupPatterns(section.Key("group_regex").MustString("")),
			InternalGroups:     splitList(section.Key("internal_groups").MustString("")),
			CAFile:             section.Key("ca_file").MustString(""),
			InsecureSkipVerify: section.Key("insecure").MustBool(false),
		})
	}
	return targets, nil
}

// splitGroupPatterns splits a comma-separated list of glob patterns. Empty
// input yields nil, which matches every group.
func splitGroupPatterns(raw string) []string {
	if raw == "" {
		return nil
	}
	var patterns []string
	for _, p := range strings.Split(raw, ",") {
		patterns = append(patterns, strings.TrimSpace(p))
	}
	return patterns
}

// splitList splits a comma-separated list of names, trimming spaces and
// dropping empty entries.
func splitList(raw string) []string {
	var names []string
	for _, name := range strings.Split(raw, ",") {
		if name = strings.TrimSpace(name); name != "" {
			names = append(names, name)
		}
	}
	return names
}

// compileGroupPatterns turns glob patterns ("*.grafana.app") into anchored
// regexps. "*" is the only special character; everything else is quoted,
// since the patterns are an allowlist and a live metacharacter would widen it.
func compileGroupPatterns(patterns []string) ([]*regexp.Regexp, error) {
	compiled := make([]*regexp.Regexp, 0, len(patterns))
	for _, p := range patterns {
		var b strings.Builder
		b.WriteString("^")
		parts := strings.Split(p, "*")
		for i, part := range parts {
			b.WriteString(regexp.QuoteMeta(part))
			// Each * in the original pattern becomes .* in the regex
			if i < len(parts)-1 {
				b.WriteString(".*")
			}
		}
		b.WriteString("$")
		regexPattern := b.String()

		re, err := regexp.Compile(regexPattern)
		if err != nil {
			return nil, fmt.Errorf("router: invalid group pattern %q: %w", p, err)
		}
		compiled = append(compiled, re)
	}
	return compiled, nil
}

// matchesAnyPattern reports whether groupName matches any of patterns. No
// patterns means every group matches.
func matchesAnyPattern(groupName string, patterns []*regexp.Regexp) bool {
	if len(patterns) == 0 {
		return true
	}
	for _, re := range patterns {
		if re.MatchString(groupName) {
			return true
		}
	}
	return false
}

// anonymousDiscovery reports whether the target's discovery polls go out
// without a CAP token.
func (c aggregateTargetConfig) anonymousDiscovery() bool {
	return c.DiscoveryAuth == discoveryAuthNone
}

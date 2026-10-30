package router

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
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
	// discoveryAuthCAPToken (also the empty default), discoveryAuthBearer or
	// discoveryAuthNone.
	// Proxied requests always carry the caller's credentials regardless.
	DiscoveryAuth      string
	GroupPatterns      []string
	CAFile             string
	InsecureSkipVerify bool
}

const aggregateSectionPrefix = "router.aggregate."

// Values of a target's discovery_auth key. Unset means discoveryAuthCAPToken.
// Both token values send an exchanged CAP token: cap_token in X-Access-Token,
// bearer in Authorization.
const (
	discoveryAuthCAPToken = "cap_token"
	discoveryAuthBearer   = "bearer"
	discoveryAuthNone     = "none"
)

// legacyBearerTargetName is the one target that got a bearer token by name,
// before discovery_auth = bearer existed. It keeps that default until its
// deployment sets discovery_auth.
const legacyBearerTargetName = "cloud_app_platform_apiserver"

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
		interval, err := parsePositiveDurationKey(section, "poll_interval", defaultAggregatePollInterval)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", raw.Name(), err)
		}
		audience := section.Key("audience").MustString("")
		discoveryAuth := section.Key("discovery_auth").MustString("")
		switch discoveryAuth {
		case "", discoveryAuthCAPToken, discoveryAuthBearer:
		case discoveryAuthNone:
			if audience != "" {
				return nil, fmt.Errorf("%s: audience must not be set when discovery_auth is %q", raw.Name(), discoveryAuthNone)
			}
		default:
			return nil, fmt.Errorf("%s: discovery_auth must be %q, %q or %q, got %q", raw.Name(), discoveryAuthCAPToken, discoveryAuthBearer, discoveryAuthNone, discoveryAuth)
		}
		groupPatterns := readGroupPatterns(section, raw.Name(), "group_patterns", "group_regex")
		targets = append(targets, aggregateTargetConfig{
			Name:               name,
			URL:                url,
			PollInterval:       interval,
			Audience:           audience,
			DiscoveryAuth:      discoveryAuth,
			GroupPatterns:      groupPatterns,
			CAFile:             section.Key("ca_file").MustString(""),
			InsecureSkipVerify: section.Key("insecure").MustBool(false),
		})
	}
	return targets, nil
}

// readGroupPatterns reads a group pattern key, or its old *_regex name. The
// old name must keep working: a router that ignored it would match every group
// the target serves.
func readGroupPatterns(section *setting.DynamicSection, sectionName, key string, legacyKey ...string) []string {
	value := section.Key(key).MustString("")
	if value != "" {
		return splitGroupPatterns(value)
	}
	for _, k := range legacyKey {
		value = section.Key(k).MustString("")
		if value != "" {
			logging.DefaultLogger.Warn("router: deprecated config key", "section", sectionName, "key", k, "replacement", key)
			return splitGroupPatterns(value)
		}
	}
	return nil
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

// compileGroupPatterns turns glob patterns ("*.grafana.app") into anchored
// regexps. "*" is the only special character; everything else is quoted,
// since the patterns are an allowlist and a live metacharacter would widen it.
// Quoting also means no pattern can fail to compile.
func compileGroupPatterns(patterns []string) []*regexp.Regexp {
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
		compiled = append(compiled, regexp.MustCompile(b.String()))
	}
	return compiled
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

// bearerDiscovery reports whether the target's discovery polls send their CAP
// token in Authorization rather than X-Access-Token.
func (c aggregateTargetConfig) bearerDiscovery() bool {
	return c.DiscoveryAuth == discoveryAuthBearer || (c.DiscoveryAuth == "" && c.Name == legacyBearerTargetName)
}

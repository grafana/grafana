package router

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/setting"
)

// aggregateTargetConfig is a named upstream apiserver whose API groups the
// router discovers by polling. Name is one of aggregateTargetNames.
type aggregateTargetConfig struct {
	Name               string
	URL                string
	Audience           string
	Auth               aggregateAuth
	GroupPatterns      []string
	CAFile             string
	InsecureSkipVerify bool
}

// aggregateAuth is the header a target reads the router's exchanged token from.
type aggregateAuth string

const (
	aggregateAuthBearer      aggregateAuth = "bearer"       // Authorization: Bearer
	aggregateAuthAccessToken aggregateAuth = "access_token" // X-Access-Token
)

// aggregateTargetNames are the fixed upstream apiservers the router aggregates,
// with the auth each expects unless <name>.auth says otherwise. See
// specs/2026-09-11-router-aggregate-discovery-design.md for why this is not a
// configurable list.
var aggregateTargetNames = []struct {
	name string
	auth aggregateAuth
}{
	{"baas_apiserver", aggregateAuthAccessToken},
	{"cloud_app_platform_apiserver", aggregateAuthBearer},
}

// parseAggregateTargets reads the <name>.url, .audience, .auth,
// .group_patterns, .ca_file and .insecure keys for each fixed target. Targets
// without a url are skipped; empty group_patterns match every group.
func parseAggregateTargets(section *setting.DynamicSection) ([]aggregateTargetConfig, error) {
	var targets []aggregateTargetConfig
	for _, target := range aggregateTargetNames {
		name := target.name
		url := section.Key(name + ".url").MustString("")
		if url == "" {
			continue
		}
		auth := aggregateAuth(section.Key(name + ".auth").MustString(string(target.auth)))
		if auth != aggregateAuthBearer && auth != aggregateAuthAccessToken {
			return nil, fmt.Errorf("%s.auth must be %q or %q, got %q", name, aggregateAuthBearer, aggregateAuthAccessToken, auth)
		}
		targets = append(targets, aggregateTargetConfig{
			Name:               name,
			URL:                url,
			Audience:           section.Key(name + ".audience").MustString(""),
			Auth:               auth,
			GroupPatterns:      splitGroupPatterns(groupPatternsKey(section, name+".group_patterns", name+".group_regex")),
			CAFile:             section.Key(name + ".ca_file").MustString(""),
			InsecureSkipVerify: section.Key(name + ".insecure").MustBool(false),
		})
	}
	return targets, nil
}

// groupPatternsKey reads a group patterns key, falling back to its former
// name. The patterns are globs, so the "regex" names were misleading.
func groupPatternsKey(section *setting.DynamicSection, key, formerKey string) string {
	if value := section.Key(key).MustString(""); value != "" {
		return value
	}
	value := section.Key(formerKey).MustString("")
	if value != "" {
		logging.DefaultLogger.Warn("router: config key was renamed, update your config", "section", cloudRouterSection, "key", formerKey, "renamedTo", key)
	}
	return value
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

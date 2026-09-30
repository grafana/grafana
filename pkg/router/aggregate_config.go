package router

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

// aggregateTargetConfig is a named upstream apiserver whose API groups the
// router discovers by polling. Name is one of aggregateTargetNames.
type aggregateTargetConfig struct {
	Name               string
	URL                string
	Audience           string
	GroupPatterns      []string
	CAFile             string
	InsecureSkipVerify bool
}

// aggregateTargetNames are the fixed upstream apiservers the router aggregates.
// See specs/2026-09-11-router-aggregate-discovery-design.md for why this is
// not a configurable list.
var aggregateTargetNames = []string{"baas_apiserver", "cloud_app_platform_apiserver"}

// parseAggregateTargets reads the <name>.url, .audience, .group_regex,
// .ca_file and .insecure keys for each fixed target. Targets without a url
// are skipped; an empty group_regex matches every group.
func parseAggregateTargets(section *setting.DynamicSection) ([]aggregateTargetConfig, error) {
	var targets []aggregateTargetConfig
	for _, name := range aggregateTargetNames {
		url := section.Key(name + ".url").MustString("")
		if url == "" {
			continue
		}
		targets = append(targets, aggregateTargetConfig{
			Name:               name,
			URL:                url,
			Audience:           section.Key(name + ".audience").MustString(""),
			GroupPatterns:      splitGroupPatterns(section.Key(name + ".group_regex").MustString("")),
			CAFile:             section.Key(name + ".ca_file").MustString(""),
			InsecureSkipVerify: section.Key(name + ".insecure").MustBool(false),
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

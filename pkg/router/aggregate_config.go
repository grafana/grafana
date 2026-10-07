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
	Name               string
	PollInterval       time.Duration
	URL                string
	Audience           string
	GroupPatterns      []string
	CAFile             string
	InsecureSkipVerify bool
}

const aggregateSectionPrefix = "router.aggregate."

// Section order determines priority when targets discover the same group.
func parseAggregateTargets(cfg *setting.Cfg) ([]aggregateTargetConfig, error) {
	var targets []aggregateTargetConfig
	configured := make(map[string]bool)
	for _, raw := range cfg.Raw.Sections() {
		name, ok := strings.CutPrefix(raw.Name(), aggregateSectionPrefix)
		if !ok {
			continue
		}
		if name == "" {
			return nil, fmt.Errorf("%s: target name is required", raw.Name())
		}
		configured[name] = true
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
		targets = append(targets, aggregateTargetConfig{
			Name:               name,
			URL:                url,
			PollInterval:       interval,
			Audience:           section.Key("audience").MustString(""),
			GroupPatterns:      splitGroupPatterns(section.Key("group_regex").MustString("")),
			CAFile:             section.Key("ca_file").MustString(""),
			InsecureSkipVerify: section.Key("insecure").MustBool(false),
		})
	}

	// REMOVE THIS SECTION AFTER IT HAS BEEN DEPLOYED AND CONFIGS UPDATED
	// Keep legacy targets during rollout, but let an explicit section replace
	// the entire target, including disabling it with an empty URL.
	legacy := cfg.SectionWithEnvOverrides(cloudRouterSection)
	// The old loader gave cloud_app_platform_apiserver priority over baas_apiserver.
	for _, name := range []string{"cloud_app_platform_apiserver", "baas_apiserver"} {
		if configured[name] {
			continue
		}
		url := legacy.Key(name + ".url").MustString("")
		if url == "" {
			continue
		}
		targets = append(targets, aggregateTargetConfig{
			Name:               name,
			URL:                url,
			PollInterval:       defaultAggregatePollInterval,
			Audience:           legacy.Key(name + ".audience").MustString(""),
			GroupPatterns:      splitGroupPatterns(legacy.Key(name + ".group_regex").MustString("")),
			CAFile:             legacy.Key(name + ".ca_file").MustString(""),
			InsecureSkipVerify: legacy.Key(name + ".insecure").MustBool(false),
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
	for p := range strings.SplitSeq(raw, ",") {
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

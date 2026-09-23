package router

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

// aggregateTargetConfig is one fixed, named upstream apiserver whose API
// groups this router discovers and aggregates -- as opposed to a forward
// backend's group, which comes from a RouteBackend CR and needs no
// discovery. Name is one of the two fixed keys read by
// parseAggregateTargets ("baas_apiserver", "cloud_app_platform_apiserver"),
// not a user-chosen label -- there is no dynamic list, only these two.
type aggregateTargetConfig struct {
	Name               string
	URL                string
	Audience           string
	GroupPatterns      []string
	CAFile             string
	InsecureSkipVerify bool
}

// aggregateTargetNames are the only two upstream apiservers this router
// aggregates today. Adding a third later means adding its name here and to
// parseAggregateTargets, not building a dynamic ini-list mechanism -- see
// the design doc's rationale for why these are fixed rather than arbitrary.
var aggregateTargetNames = []string{"baas_apiserver", "cloud_app_platform_apiserver"}

// parseAggregateTargets reads the two fixed aggregate-apiserver targets from
// the cloud_router section using dotted key names (<name>.url,
// <name>.group_regex, <name>.audience, <name>.ca_file, <name>.insecure). A
// target is included in the result only if its .url key is set; group_regex
// is optional (nil means "match every group", not "match nothing" -- see
// matchesAnyPattern). ca_file/insecure mirror the naming of the
// appmanifest apiserver's apiserver_ca_file/apiserver_insecure keys, but are
// per-target since each aggregate target can be a different remote apiserver
// with its own CA.
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

// splitGroupPatterns splits a comma-separated group_regex config value into
// its constituent glob patterns, trimming surrounding whitespace from each.
// Shared by parseAggregateTargets and the plugins_url target's
// plugins_group_regex, which is optional in exactly the same way. Empty
// input yields nil, matching compileGroupPatterns/matchesAnyPattern's "nil
// means match every group" contract.
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

// compileGroupPatterns turns glob-style patterns ("*.grafana.app") into
// anchored regexps. "*" is the only special character; everything between the
// "*" split points is escaped with regexp.QuoteMeta so it matches literally.
// Escaping only "." (as an earlier version did) left every other regex
// metacharacter live, which *widens* the match -- "foo+.grafana.app" would
// compile to ^foo+\.grafana\.app$ and match "foooo.grafana.app". group_regex
// is a narrowing allowlist, so over-matching is the wrong failure direction.
//
// Because QuoteMeta always yields a valid literal, the generated expression
// can no longer fail to compile for any input; the error return is kept
// because regexp.Compile's contract is what it is, not because there is a
// reachable invalid-pattern case (see the tests).
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

// matchesAnyPattern reports whether groupName matches any of patterns.
// An empty/nil patterns list means "aggregate every group" -- the
// shortlist is opt-in narrowing, not opt-in inclusion (see AGENTS.md's
// framing of group_regex as an optional narrowing arg).
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

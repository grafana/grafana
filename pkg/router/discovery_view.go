package router

import (
	"errors"
	"net/http"
	"slices"
)

// discoveryRule narrows the root discovery a request sees when it carries
// Header. The sources that know a header's meaning supply the rules, so the
// engine never reads a deployment-specific name.
type discoveryRule struct {
	Header string
	// Value, when set, is the only value of Header the rule applies to; rules
	// may share a header and tell requests apart by it. Empty means any value.
	Value string
	// SkipSource leaves out what the source of unserved groups would add.
	SkipSource bool
	// Exclude leaves out the router's own entries it reports true for.
	Exclude func(servingEntry) bool
}

// discoveryView is what one request sees of root discovery.
type discoveryView struct {
	active     bool
	skipSource bool
	exclude    []func(servingEntry) bool
}

func (r *GrafanaRouter) discoveryView(req *http.Request) discoveryView {
	var v discoveryView
	for _, rule := range r.discoveryRules {
		if value := req.Header.Get(rule.Header); value == "" || rule.Value != "" && value != rule.Value {
			continue
		}
		v.active = true
		v.skipSource = v.skipSource || rule.SkipSource
		if rule.Exclude != nil {
			v.exclude = append(v.exclude, rule.Exclude)
		}
	}
	return v
}

func (v discoveryView) excludes(entry servingEntry) bool {
	for _, exclude := range v.exclude {
		if exclude(entry) {
			return true
		}
	}
	return false
}

// varyOnDiscoveryRules marks a root discovery response as varying on the
// rules' headers, since the same URL has more than one view.
func (r *GrafanaRouter) varyOnDiscoveryRules(w http.ResponseWriter) {
	var varied []string
	for _, rule := range r.discoveryRules {
		if !slices.Contains(varied, rule.Header) {
			varied = append(varied, rule.Header)
			w.Header().Add("Vary", rule.Header)
		}
	}
}

// errDiscoverySourceSkipped means the request asked not to read the source of
// unserved groups.
var errDiscoverySourceSkipped = errors.New("router: discovery source skipped")

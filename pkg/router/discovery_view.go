package router

import (
	"errors"
	"net/http"
)

// discoveryRule narrows the root discovery a request sees when it carries
// Header. The sources that know a header's meaning supply the rules, so the
// engine never reads a deployment-specific name.
type discoveryRule struct {
	Header string
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
		if req.Header.Get(rule.Header) == "" {
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
	for _, rule := range r.discoveryRules {
		w.Header().Add("Vary", rule.Header)
	}
}

// errDiscoverySourceSkipped means the request asked not to read the source of
// unserved groups.
var errDiscoverySourceSkipped = errors.New("router: discovery source skipped")

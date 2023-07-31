package accesspolicy

import (
	"sort"

	"github.com/grafana/grafana/pkg/util"
)

const PermissionsTarget = "permissions"
const AllowAll = "*"
const AllowNone = "none"

func ReduceRules(rules []AccessRule) []AccessRule {
	type verbs struct {
		Verb     map[string][]string
		Terminal string
	}

	kinds := make(map[string]*verbs)
	for _, rule := range rules {
		if rule.Kind == "" || rule.Verb == "" {
			continue // invalid
		}

		// flip write permission to *
		if rule.Target != nil && *rule.Target == PermissionsTarget {
			if rule.Verb == "write" {
				rule.Verb = AllowAll
			}
		}
		kind, ok := kinds[rule.Kind]
		if !ok {
			kind = &verbs{
				Verb: make(map[string][]string),
			}
			kinds[rule.Kind] = kind
		}

		terminal := rule.Verb == AllowAll || rule.Verb == AllowNone
		if terminal {
			if rule.Kind == AllowAll {
				return []AccessRule{rule}
			}
			kind.Terminal = rule.Verb
		} else if kind.Terminal == "" {
			targets, ok := kind.Verb[rule.Verb]
			if !ok {
				targets = []string{}
			}
			if rule.Target != nil && !contains(targets, *rule.Target) {
				targets = append(targets, *rule.Target)
				sort.Strings(targets)
			}
			kind.Verb[rule.Verb] = targets
		}
	}

	results := make([]AccessRule, 0)
	for _, kind := range getSortedKeys(kinds) {
		verb := kinds[kind]
		if verb.Terminal != "" {
			results = append(results, AccessRule{Kind: kind, Verb: verb.Terminal})
		} else {
			for _, v := range getSortedKeys(verb.Verb) {
				targets := verb.Verb[v]
				if len(targets) == 0 {
					results = append(results, AccessRule{Kind: kind, Verb: v})
				} else {
					for _, t := range targets {
						results = append(results, AccessRule{
							Kind:   kind,
							Verb:   v,
							Target: util.Pointer(t),
						})
					}
				}
			}
		}
	}
	return results
}

func getSortedKeys[T any](vals map[string]T) []string {
	keys := make([]string, 0, len(vals))
	for k := range vals {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func contains[T comparable](s []T, e T) bool {
	for _, v := range s {
		if v == e {
			return true
		}
	}
	return false
}

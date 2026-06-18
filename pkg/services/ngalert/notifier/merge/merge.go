// Package merge contains the Alertmanager configuration merge logic used by Grafana to
// reconcile imported (Mimir/Prometheus-format) configurations with Grafana-native ones.
//
// The implementation in this package is forked from
// github.com/grafana/alerting/definition/merge.go so that Grafana can evolve the merge
// behaviour independently of the upstream alerting library. The wire-format types
// (PostableApiAlertingConfig, Route, PostableApiReceiver, …) continue to come from
// github.com/grafana/alerting/definition; only the merge logic is local.
package merge

import (
	"context"
	"fmt"
	"hash/fnv"
	"maps"
	"math"
	"slices"
	"strings"

	"github.com/grafana/alerting/utils/hash"
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/util"
)

// RenameResources describes which incoming resources were renamed to avoid conflicts with existing ones.
// In each map the key is the original incoming name and the value is the new name assigned during the merge.
type RenameResources struct {
	Receivers     map[string]string
	TimeIntervals map[string]string
	Templates     map[string]string
}

// MergeResult describes what changed during a merge: which resources were added and which were renamed.
type MergeResult struct {
	RenameResources
	// AddedRoute is the identifier of the routing sub-tree added to the configuration.
	AddedRoute string
	// AddedReceivers contains receivers added to the merged config. If the receiver was renamed, this list contains the new name.
	AddedReceivers []string
	// AddedTimeIntervals contains time intervals added to the merged config. If the time interval was renamed, this list contains the new name.
	AddedTimeIntervals   []string
	AddedTemplates       []string
	AddedInhibitionRules []string
}

// LogContext returns key-value pairs describing what changed during the merge, suitable for structured logging.
// Returns nil when nothing was added or renamed.
func (m MergeResult) LogContext() []any {
	if len(m.Receivers) == 0 && len(m.TimeIntervals) == 0 &&
		len(m.AddedReceivers) == 0 && len(m.AddedTimeIntervals) == 0 &&
		len(m.AddedTemplates) == 0 && len(m.AddedInhibitionRules) == 0 {
		return nil
	}
	logCtx := make([]any, 0, 12)
	logCtx = append(logCtx, "route", m.AddedRoute)
	if len(m.AddedReceivers) > 0 {
		logCtx = append(logCtx, "receivers", fmt.Sprintf("%v", m.AddedReceivers))
	}
	if len(m.AddedTimeIntervals) > 0 {
		logCtx = append(logCtx, "timeIntervals", fmt.Sprintf("%v", m.AddedTimeIntervals))
	}
	if len(m.AddedTemplates) > 0 {
		logCtx = append(logCtx, "templates", fmt.Sprintf("%v", m.AddedTemplates))
	}
	if len(m.AddedInhibitionRules) > 0 {
		logCtx = append(logCtx, "inhibitionRules", fmt.Sprintf("%v", m.AddedInhibitionRules))
	}
	if len(m.Receivers) > 0 {
		rcvBuilder := strings.Builder{}
		for from, to := range m.Receivers {
			_, _ = fmt.Fprintf(&rcvBuilder, "'%s'->'%s',", from, to)
		}
		logCtx = append(logCtx, "renamedReceivers", fmt.Sprintf("[%s]", rcvBuilder.String()[0:rcvBuilder.Len()-1]))
	}
	if len(m.TimeIntervals) > 0 {
		intervalBuilder := strings.Builder{}
		for from, to := range m.TimeIntervals {
			_, _ = fmt.Fprintf(&intervalBuilder, "'%s'->'%s',", from, to)
		}
		logCtx = append(logCtx, "renamedTimeIntervals", fmt.Sprintf("[%s]", intervalBuilder.String()[0:intervalBuilder.Len()-1]))
	}
	if len(m.Templates) > 0 {
		tmplBuilder := strings.Builder{}
		for from, to := range m.Templates {
			_, _ = fmt.Fprintf(&tmplBuilder, "'%s'->'%s',", from, to)
		}
		logCtx = append(logCtx, "renamedTemplates", fmt.Sprintf("[%s]", tmplBuilder.String()[0:tmplBuilder.Len()-1]))
	}
	return logCtx
}

// MergeExtraConfig merges extra configurations in cfg into the base Grafana configuration.
// If no extra configurations are present, it returns the base configuration wrapped in a MergeResult.
//
// The merge combines two Alertmanager configurations into a single unified configuration,
// handling three main aspects:
//
//  1. Resource Deduplication:
//     When resources (receivers or time intervals) with identical names exist in both configurations,
//     resources from the extra configuration are renamed according to these rules:
//     - First, the extra configuration's Identifier is appended to the name
//     - If the name is still not unique, a numbered suffix is added (e.g., "_01", "_02")
//     - All references to renamed resources are automatically updated throughout the configuration
//
//  2. Route Merging:
//     - The entire routing tree from the extra configuration is inserted as a sub-tree under
//     the root route of the base configuration
//     - The sub-tree is positioned as the first route in the list of routes
//     - Default timing settings (GroupWait, GroupInterval, RepeatInterval) are explicitly set
//     on the imported route to prevent inheriting potentially unwanted defaults from the parent
//
//  3. Inhibit Rule Merging:
//     - All inhibit rules from the extra configuration are copied to the result
//
// Templates and inhibition rules produced by the merge are created with ProvenanceNone; final provenance is assigned by the provisioning layer based on where the resource is stored.
func MergeExtraConfig(_ context.Context, cfg *v1.AMConfigV1) (v1.AMConfigV1, MergeResult, error) {
	if len(cfg.ExtraConfigs) == 0 {
		return *cfg, MergeResult{}, nil
	}
	// support only one config for now
	mimirCfg := cfg.ExtraConfigs[0]
	if err := mimirCfg.Validate(); err != nil {
		return v1.AMConfigV1{}, MergeResult{}, fmt.Errorf("invalid extra configuration: %w", err)
	}
	mcfg, err := mimirCfg.GetAlertmanagerConfig()
	if err != nil {
		return v1.AMConfigV1{}, MergeResult{}, fmt.Errorf("failed to get mimir alertmanager config: %w", err)
	}

	if _, ok := cfg.ManagedRoutes[mimirCfg.Identifier]; ok || mimirCfg.Identifier == models.DefaultRoutingTreeName {
		return v1.AMConfigV1{}, MergeResult{}, fmt.Errorf("cannot merge because config %s because it conflicts with existing managed route", mimirCfg.Identifier)
	}

	mergedReceivers, renamedReceivers, addedReceivers := Receivers(cfg.AlertmanagerConfig.Receivers, mcfg.Receivers, mimirCfg.Identifier)

	mergedTimeIntervals, renamedTimeIntervals, addedTimeIntervals := TimeIntervals(
		cfg.AlertmanagerConfig.MuteTimeIntervals,
		cfg.AlertmanagerConfig.TimeIntervals,
		mcfg.MuteTimeIntervals,
		mcfg.TimeIntervals,
		mimirCfg.Identifier,
	)

	managedRoutes := make(v1.ManagedRoutes, len(cfg.ManagedRoutes)+1)
	{
		maps.Copy(managedRoutes, cfg.ManagedRoutes)
		extraRoute := mcfg.Route
		RenameResourceUsagesInRoutes([]*v1.Route{extraRoute}, RenameResources{Receivers: renamedReceivers, TimeIntervals: renamedTimeIntervals})
		managedRoutes[mimirCfg.Identifier] = extraRoute
	}

	managedInhibitionRules, addedInhibitionRules, err := MergeInhibitionRules(cfg.InhibitionRules, mcfg.InhibitRules, mimirCfg.Identifier)
	if err != nil {
		return v1.AMConfigV1{}, MergeResult{}, fmt.Errorf("failed to merge inhibition rules: %w", err)
	}

	templates, renamedTemplates, addedUIDs, err := MergeTemplates(cfg.Templates, mimirCfg.TemplateFiles, mimirCfg.Identifier)
	if err != nil {
		return v1.AMConfigV1{}, MergeResult{}, fmt.Errorf("failed to merge template files: %w", err)
	}
	addedTemplates := make([]string, 0, len(addedUIDs))
	for _, uid := range addedUIDs {
		if tmpl, ok := templates[uid]; ok {
			addedTemplates = append(addedTemplates, tmpl.Title)
		}
	}

	return v1.AMConfigV1{
			ExtraConfigs: cfg.ExtraConfigs[1:],
			Templates:    templates,
			AlertmanagerConfig: v1.PostableApiAlertingConfig{
				Config: v1.Config{
					Global:        nil, // Grafana does not use global. The Global settings are set to the respective integrations at parse time.
					Route:         cfg.AlertmanagerConfig.Route,
					InhibitRules:  cfg.AlertmanagerConfig.InhibitRules,
					TimeIntervals: mergedTimeIntervals,
					Templates:     nil, // Grafana does not use this.
				},
				Receivers: mergedReceivers,
			},
			ManagedRoutes:   managedRoutes,
			InhibitionRules: managedInhibitionRules,
		}, MergeResult{
			RenameResources:      RenameResources{Receivers: renamedReceivers, TimeIntervals: renamedTimeIntervals, Templates: renamedTemplates},
			AddedRoute:           mimirCfg.Identifier,
			AddedReceivers:       addedReceivers,
			AddedTimeIntervals:   addedTimeIntervals,
			AddedTemplates:       addedTemplates,
			AddedInhibitionRules: addedInhibitionRules,
		}, nil
}

// DeduplicateResources merges existing and incoming resources (receivers and time intervals) and ensures unique names by applying suffixes. Returns renamed resources for tracking adjustments made.
func DeduplicateResources(a, b v1.PostableApiAlertingConfig, suffix string) RenameResources {
	_, renamedReceivers, _ := Receivers(a.Receivers, b.Receivers, suffix)
	_, renamedTimeIntervals, _ := TimeIntervals(
		a.MuteTimeIntervals,
		a.TimeIntervals,
		b.MuteTimeIntervals,
		b.TimeIntervals,
		suffix,
	)
	return RenameResources{Receivers: renamedReceivers, TimeIntervals: renamedTimeIntervals}
}

// TimeIntervals merges existing and incoming time intervals and mute intervals, ensuring unique names by applying suffixes.
// It returns a merged list of time intervals, a map of renamed interval names for tracking adjustments made, and the final
// names of the incoming intervals (post-rename) in their original order (mute intervals first, then time intervals).
// Mute time intervals are converted to time intervals.
func TimeIntervals(
	existingMuteIntervals []v1.MuteTimeInterval,
	existingTimeIntervals []v1.TimeInterval,
	incomingMuteIntervals []v1.MuteTimeInterval,
	incomingTimeIntervals []v1.TimeInterval,
	suffix string,
) ([]v1.TimeInterval, map[string]string, []string) {
	// combine all incoming intervals into a single list
	incomingAll := make([]v1.TimeInterval, 0, len(incomingTimeIntervals)+len(incomingMuteIntervals))
	for _, interval := range incomingMuteIntervals {
		incomingAll = append(incomingAll, v1.TimeInterval(interval))
	}
	incomingAll = append(incomingAll, incomingTimeIntervals...)
	usedNames := createIndexTimeIntervals(existingMuteIntervals, existingTimeIntervals, incomingAll)
	result := make([]v1.TimeInterval, 0, len(existingMuteIntervals)+len(existingTimeIntervals)+len(incomingMuteIntervals)+len(incomingTimeIntervals))
	// fold mute time intervals into time intervals. The order is important here because during the applying time intervals with the same name win
	for _, interval := range existingMuteIntervals {
		result = append(result, v1.TimeInterval(interval))
	}
	result = append(result, existingTimeIntervals...)
	renames := make(map[string]string)
	added := make([]string, 0, len(incomingAll))
	for idx, interval := range incomingAll {
		curName := interval.Name
		if i, ok := usedNames[curName]; ok && i != idx { // if the name is already used by another interval, append a suffix.
			newName := getUniqueName(curName, suffix, usedNames)
			renames[curName] = newName
			usedNames[newName] = idx
			interval.Name = newName
		}
		added = append(added, interval.Name)
		result = append(result, interval)
	}
	return result, renames, added
}

func createIndexTimeIntervals(
	existingMuteIntervals []v1.MuteTimeInterval,
	existingTimeIntervals []v1.TimeInterval,
	incomingTimeIntervals []v1.TimeInterval,
) map[string]int {
	// usedNames is a map of existing interval names where value is the index of the interval that holds the name in the incoming list.
	usedNames := make(map[string]int, len(existingMuteIntervals)+len(existingTimeIntervals)+len(incomingTimeIntervals))
	for _, r := range existingMuteIntervals {
		usedNames[r.Name] = -1
	}
	for _, r := range existingTimeIntervals {
		usedNames[r.Name] = -1
	}
	for idx, r := range incomingTimeIntervals {
		if _, ok := usedNames[r.Name]; !ok {
			usedNames[r.Name] = idx
		}
	}
	return usedNames
}

// RenameResourceUsagesInRoutes updates the receiver and mute/active time intervals of routes based on the provided rename resources.
func RenameResourceUsagesInRoutes(routes []*v1.Route, renames RenameResources) {
	for _, r := range routes {
		if r == nil {
			continue
		}
		if r.Receiver != "" {
			if newName, ok := renames.Receivers[r.Receiver]; ok {
				r.Receiver = newName
			}
		}
		for i := range r.MuteTimeIntervals {
			if newName, ok := renames.TimeIntervals[r.MuteTimeIntervals[i]]; ok {
				r.MuteTimeIntervals[i] = newName
			}
		}
		for i := range r.ActiveTimeIntervals {
			if newName, ok := renames.TimeIntervals[r.ActiveTimeIntervals[i]]; ok {
				r.ActiveTimeIntervals[i] = newName
			}
		}
		RenameResourceUsagesInRoutes(r.Routes, renames)
	}
}

// Receivers merges two lists of PostableApiReceiver objects, ensuring unique names by appending a suffix if necessary.
// It returns the combined list of receivers, a map of renamed original names to their new unique names, and the incoming
// receivers in their original order after any renames have been applied.
// The items of the existing list are added to the result list as is whereas the items of incoming list are copied (shallow copy)
// and renamed if necessary.
func Receivers(existing, incoming []*v1.PostableApiReceiver, suffix string) ([]*v1.PostableApiReceiver, map[string]string, []string) {
	result := make([]*v1.PostableApiReceiver, 0, len(existing)+len(incoming))
	result = append(result, existing...)
	usedNames := createIndexReceivers(existing, incoming)
	renames := make(map[string]string)
	added := make([]string, 0, len(incoming))
	for idx, r := range incoming {
		if r == nil {
			continue
		}
		cpy := *r
		if i, ok := usedNames[cpy.Name]; ok && i != idx {
			newName := getUniqueName(cpy.Name, suffix, usedNames)
			renames[cpy.Name] = newName
			cpy.Name = newName
			usedNames[cpy.Name] = i
		}
		added = append(added, cpy.Name)
		result = append(result, &cpy)
	}
	return result, renames, added
}

func createIndexReceivers(existing, incoming []*v1.PostableApiReceiver) map[string]int {
	usedNames := make(map[string]int, len(existing)+len(incoming))
	for _, e := range existing {
		usedNames[e.Name] = -1
	}
	for idx, i := range incoming {
		if _, ok := usedNames[i.Name]; !ok {
			usedNames[i.Name] = idx
		}
	}
	return usedNames
}

// MergeInhibitionRules merges incoming Alertmanager inhibition rules into an existing set of Grafana-managed ones.
// Each incoming rule is scoped to the given identifier by appending a matcher on models.NamedRouteLabel,
// and all deprecated match/match_re fields are folded into the modern matchers slice.
// UIDs are derived from a stable hash of (rule, index, identifier); collisions fall back to a short random UID.
// Returns the merged map (existing + incoming) and the UIDs of the newly added rules.
func MergeInhibitionRules(existing map[v1.ResourceUID]v1.InhibitionRule, incoming []config.InhibitRule, identifier string) (result map[v1.ResourceUID]v1.InhibitionRule, added []string, err error) {
	added = make([]string, 0, len(incoming))
	result = make(map[v1.ResourceUID]v1.InhibitionRule, len(incoming)+len(existing))
	maps.Copy(result, existing)
	matcher := v1.NewMatcher(v1.MatcherEqual, models.NamedRouteLabel, identifier)
	for idx, rule := range incoming {
		var name string
		{
			hasher := fnv.New64a()
			hash.DeepHashObject(hasher, []any{rule, idx, identifier})
			name = fmt.Sprintf("%x", hasher.Sum64()) // uid is a hash of the rule and the index, which guarantees uniqueness
			// try to generate a stable name for the rule. Fallback to uuid if the name is already taken.
			if _, ok := result[v1.ResourceUID(name)]; ok || len(name) > util.MaxUIDLength {
				name = util.GenerateShortUID()
			}
		}

		source := append(foldMatchers(rule.SourceMatch, rule.SourceMatchRE, rule.SourceMatchers), matcher)
		target := append(foldMatchers(rule.TargetMatch, rule.TargetMatchRE, rule.TargetMatchers), matcher)
		ir := v1.NewInhibitionRule(name, source, target, rule.Equal, models.ProvenanceNone)
		if err := ir.Validate(); err != nil {
			return nil, nil, fmt.Errorf("cannot convert inhibition rule at index %d: %w", idx, err)
		}
		result[ir.UID] = ir
		added = append(added, string(ir.UID))
	}
	return result, added, nil
}

// MergeTemplates merges the incoming templates with the existing ones, renaming conflicts.
// When an incoming Mimir template name collides with an existing Mimir template name, the
// incoming template is renamed by appending identifier as a suffix (same semantics as Receivers).
// UIDs are derived from a stable hash of (finalName, content, identifier); collisions fall back
// to a short random UID.
// Returns the merged map, a rename map (original→final name), the UIDs of added templates,
// and an error.
func MergeTemplates(existing map[v1.ResourceUID]v1.TemplateGroup, incoming map[string]string, identifier string) (templates map[v1.ResourceUID]v1.TemplateGroup, renames map[string]string, added []v1.ResourceUID, err error) {
	// Index existing Mimir template names to detect conflicts.
	usedNames := make(map[string]struct{}, len(existing))
	for _, tmpl := range existing {
		if tmpl.Kind == v1.TemplateKindMimir {
			usedNames[tmpl.Title] = struct{}{}
		}
	}

	templates = make(map[v1.ResourceUID]v1.TemplateGroup, len(existing)+len(incoming))
	maps.Copy(templates, existing)
	renames = make(map[string]string)
	added = make([]v1.ResourceUID, 0, len(incoming))

for _, name := range slices.Sorted(maps.Keys(incoming)) {
		content := incoming[name]
		finalName := name
		if _, exists := usedNames[name]; exists {
			finalName = getUniqueName(name, identifier, usedNames)
			renames[name] = finalName
		}
		usedNames[finalName] = struct{}{}

		hasher := fnv.New64a()
		hash.DeepHashObject(hasher, []any{finalName, content, identifier})
		uid := fmt.Sprintf("%x", hasher.Sum64())
		if _, ok := templates[v1.ResourceUID(uid)]; ok || len(uid) > util.MaxUIDLength {
			uid = util.GenerateShortUID()
		}

		tmpl := v1.NewTemplateGroup(v1.ResourceUID(uid), finalName, content, v1.TemplateKindMimir, models.ProvenanceNone)
		templates[tmpl.UID] = tmpl
		added = append(added, tmpl.UID)
	}
	return templates, renames, added, nil
}

func foldMatchers(match map[string]string, matchRE config.MatchRegexps, matchers config.Matchers) []v1.Matcher {
	out := make([]v1.Matcher, 0, len(match)+len(matchRE)+len(matchers))
	out = append(out, v1.MatchersToModel(matchers)...)
	for _, ln := range slices.Sorted(maps.Keys(match)) {
		out = append(out, v1.NewMatcher(v1.MatcherEqual, ln, match[ln]))
	}
	for _, ln := range slices.Sorted(maps.Keys(matchRE)) {
		out = append(out, v1.NewMatcher(v1.MatcherEqualRegex, ln, matchRE[ln].String()))
	}
	return out
}

func getUniqueName[T any](name string, suffix string, usedNames map[string]T) string {
	result := name
	done := false
	for i := 0; i <= math.MaxInt32; i++ {
		if _, ok := usedNames[result]; !ok {
			done = true
			break
		}
		if i == 0 {
			result = fmt.Sprintf("%s%s", name, suffix)
		} else {
			result = fmt.Sprintf("%s%s_%02d", name, suffix, i) // in case "a" has both receivers with and without a suffix
		}
	}
	if !done {
		panic(fmt.Sprintf("unable to find unique name for %s", name))
	}
	return result
}

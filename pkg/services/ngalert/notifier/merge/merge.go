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
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
)

var (
	ErrInvalidMatchers         = errors.New("only equality matchers are allowed")
	ErrDuplicateMatchers       = errors.New("matchers should be unique")
	ErrSubtreeMatchersConflict = errors.New("subtree matchers conflict with existing Grafana routes, merging will break existing notifications")
)

type MergeOpts struct {
	// DedupSuffix is a string suffix that will be appended to any resources (receivers or time intervals)
	// from the secondary configuration that have name conflicts with the primary configuration.
	//
	// The deduplication process works as follows:
	// 1. If a resource from the secondary config has the same name as one in the primary config,
	//    this suffix is appended to create a new name (e.g., "webhook" becomes "webhooksuffix")
	// 2. If the new name still conflicts, a sequential number is added (e.g., "webhooksuffix_01")
	// 3. All references to renamed resources are automatically updated throughout the configuration
	//
	// When left empty, only numeric suffixes will be used for deduplication (e.g., "webhook_01").
	//
	// Example usage:
	//   MergeOpts{
	//     DedupSuffix: "_secondary",  // Results in names like "webhook_secondary" or "webhook_secondary_01"
	//   }
	//
	// This field helps maintain distinct resource identities while preserving relationships
	// between components during the merge process.
	DedupSuffix string
	// SubtreeMatchers specifies a list of matchers that will be applied to the root route
	// of the routing tree being merged. These matchers are essential for properly isolating
	// and identifying alerts from the secondary configuration after merging.
	//
	// The matchers must follow these requirements:
	// - Each matcher must use the equality operator (labels.MatchEqual type)
	// - Each matcher name must be unique within the list
	//
	// Example usage:
	//   SubtreeMatchers: config.Matchers{
	//     {Name: "source", Value: "external", Type: labels.MatchEqual},
	//     {Name: "environment", Value: "production", Type: labels.MatchEqual},
	//   }
	//
	// These matchers will be:
	// 1. Added to the root of the secondary routing tree during merge
	// 2. Added to both source and target matchers of all inhibit rules from the secondary config
	// 3. Used to ensure alerts are properly routed after configurations are merged
	//
	// Warning: If these matchers conflict with existing routes in the primary configuration,
	// the merge operation will fail with ErrSubtreeMatchersConflict to prevent breaking
	// existing notification flows.
	SubtreeMatchers config.Matchers
}

func (o MergeOpts) Validate() error {
	seenNames := make(map[string]struct{}, len(o.SubtreeMatchers))
	for _, matcher := range o.SubtreeMatchers {
		if _, ok := seenNames[matcher.Name]; ok {
			return ErrDuplicateMatchers
		}
		if matcher.Type != labels.MatchEqual {
			return ErrInvalidMatchers
		}
		seenNames[matcher.Name] = struct{}{}
	}
	return nil
}

// MergeResult represents the result of merging two Alertmanager configurations.
// It contains the unified configuration and maps of renamed receivers and time intervals.
//
// Identifier, ExtraRoute and ExtraInhibitRules are populated by GetMergedAlertmanagerConfig
// when the merge consumed an imported (Mimir-format) configuration; they expose the
// imported route subtree and inhibit rules separately so callers can register them as
// managed routes / managed inhibit rules. Plain calls to Merge leave these fields zero.
type MergeResult struct {
	Config definition.PostableApiAlertingConfig
	RenameResources
	Identifier        string
	ExtraRoute        *definition.Route
	ExtraInhibitRules []config.InhibitRule
}

type RenameResources struct {
	Receivers     map[string]string
	TimeIntervals map[string]string
}

// LogContext returns key-value pairs describing any receiver or time-interval renames the
// merge produced, suitable for structured logging. Returns nil when nothing was renamed.
func (m MergeResult) LogContext() []any {
	if len(m.Receivers) == 0 && len(m.TimeIntervals) == 0 {
		return nil
	}
	logCtx := make([]any, 0, 6)
	logCtx = append(logCtx, "identifier", m.Identifier)
	if len(m.Receivers) > 0 {
		rcvBuilder := strings.Builder{}
		for from, to := range m.Receivers {
			fmt.Fprintf(&rcvBuilder, "'%s'->'%s',", from, to)
		}
		logCtx = append(logCtx, "renamedReceivers", fmt.Sprintf("[%s]", rcvBuilder.String()[0:rcvBuilder.Len()-1]))
	}
	if len(m.TimeIntervals) > 0 {
		intervalBuilder := strings.Builder{}
		for from, to := range m.TimeIntervals {
			fmt.Fprintf(&intervalBuilder, "'%s'->'%s',", from, to)
		}
		logCtx = append(logCtx, "renamedTimeIntervals", fmt.Sprintf("[%s]", intervalBuilder.String()[0:intervalBuilder.Len()-1]))
	}
	return logCtx
}

// GetMergedAlertmanagerConfig merges the given imported alertmanager configuration into
// the base Grafana configuration. The imported route is also returned separately on
// MergeResult.ExtraRoute (after rename application) so callers can register it as a
// managed route. The imported inhibit rules are returned on MergeResult.ExtraInhibitRules.
//
// The given identifier is used as the dedup suffix for receiver / time-interval name
// collisions and as the MergeResult.Identifier. The given matchers are used as the subtree
// matchers for the merge.
func GetMergedAlertmanagerConfig(
	base definition.PostableApiAlertingConfig,
	imported definition.PostableApiAlertingConfig,
	identifier string,
	matchers config.Matchers,
) (MergeResult, error) {
	opts := MergeOpts{
		DedupSuffix:     identifier,
		SubtreeMatchers: matchers,
	}
	if err := opts.Validate(); err != nil {
		return MergeResult{}, fmt.Errorf("invalid merge options: %w", err)
	}

	m, err := Merge(base, imported, opts)
	if err != nil {
		return MergeResult{}, fmt.Errorf("failed to merge alertmanager config: %w", err)
	}

	route := imported.Route
	RenameResourceUsagesInRoutes([]*definition.Route{route}, m.RenameResources)

	return MergeResult{
		Config:            m.Config,
		RenameResources:   m.RenameResources,
		Identifier:        identifier,
		ExtraRoute:        route,
		ExtraInhibitRules: imported.InhibitRules,
	}, nil
}

// Merge combines two Alertmanager configurations into a single unified configuration.
//
// The function handles three main aspects of the merge process:
//
//  1. Resource Deduplication:
//     When resources (receivers or time intervals) with identical names exist in both configurations,
//     resources from configuration "b" are renamed according to these rules:
//     - First, the MergeOpts.DedupSuffix is appended to the name
//     - If the name is still not unique, a numbered suffix is added (e.g., "_01", "_02")
//     - All references to renamed resources are automatically updated throughout the configuration
//
// 2. Route Merging:
//   - The entire routing tree from "b" is inserted as a sub-tree under the root route of "a"
//   - The sub-tree is positioned as the first route in the list of routes
//   - The MergeOpts.SubtreeMatchers are added to the root of the "b" routing tree
//   - Default timing settings (GroupWait, GroupInterval, RepeatInterval) are explicitly set
//     on the "b" route to prevent inheriting potentially unwanted defaults from the parent configuration
//   - If any existing routes in "a" would match the SubtreeMatchers, the merge will fail with
//     ErrSubtreeMatchersConflict to prevent breaking existing routing behavior
//
// 3. Inhibit Rule Merging:
//   - All inhibit rules from "b" are copied to the result
//   - MergeOpts.SubtreeMatchers are added to both source and target matchers of each
//     copied inhibit rule to maintain proper context separation
//
// Returns a MergeResult containing the merged configuration and maps of renamed resources
// that can be used to track the renaming that occurred during the merge process.
//
// Example usage:
//
//	result, err := Merge(primaryConfig, secondaryConfig, MergeOpts{
//	  DedupSuffix: "_secondary",
//	  SubtreeMatchers: config.Matchers{
//	    {Name: "source", Value: "external", Type: labels.MatchEqual},
//	  },
//	})
//
// If the merge fails with ErrSubtreeMatchersConflict, it indicates that the SubtreeMatchers
// would conflict with existing routes, potentially disrupting alert notifications. In this
// case, you should choose different SubtreeMatchers that don't overlap with existing route
// matchers.
func Merge(a, b definition.PostableApiAlertingConfig, opts MergeOpts) (MergeResult, error) {
	if err := opts.Validate(); err != nil {
		return MergeResult{}, err
	}

	if len(opts.SubtreeMatchers) > 0 {
		match, err := checkIfMatchersUsed(opts.SubtreeMatchers, a.Route.Routes)
		if err != nil {
			return MergeResult{}, err
		}
		if match {
			return MergeResult{}, fmt.Errorf("%w: sub tree matchers: %s", ErrSubtreeMatchersConflict, opts.SubtreeMatchers)
		}
	}

	mergedReceivers, renamedReceivers := MergeReceivers(a.Receivers, b.Receivers, opts.DedupSuffix)

	mergedTimeInterval, renamedTimeIntervals := MergeTimeIntervals(
		a.MuteTimeIntervals,
		a.TimeIntervals,
		b.MuteTimeIntervals,
		b.TimeIntervals,
		opts.DedupSuffix,
	)

	renamed := RenameResources{
		Receivers:     renamedReceivers,
		TimeIntervals: renamedTimeIntervals,
	}

	route := a.Route
	inhibitRules := a.InhibitRules
	if len(opts.SubtreeMatchers) > 0 {
		RenameResourceUsagesInRoutes([]*definition.Route{b.Route}, renamed)
		if route == nil {
			return MergeResult{}, fmt.Errorf("cannot merge into undefined routing tree")
		}
		if b.Route == nil {
			return MergeResult{}, fmt.Errorf("cannot merge undefined routing tree")
		}
		route = MergeRoutes(*route, *b.Route, opts.SubtreeMatchers)
		inhibitRules = MergeInhibitRules(inhibitRules, b.InhibitRules, opts.SubtreeMatchers)
	}

	return MergeResult{
		Config: definition.PostableApiAlertingConfig{
			Config: definition.Config{
				Global:            nil, // Grafana does not have global.
				Route:             route,
				InhibitRules:      inhibitRules,
				MuteTimeIntervals: a.MuteTimeIntervals,
				TimeIntervals:     mergedTimeInterval,
				Templates:         nil, // we do not use this.
			},
			Receivers: mergedReceivers,
		},
		RenameResources: renamed,
	}, nil
}

// DeduplicateResources merges existing and incoming resources (receivers and time intervals) and ensures unique names by applying suffixes. Returns renamed resources for tracking adjustments made.
func DeduplicateResources(a, b definition.PostableApiAlertingConfig, opts MergeOpts) (RenameResources, error) {
	_, renamedReceivers := MergeReceivers(a.Receivers, b.Receivers, opts.DedupSuffix)

	_, renamedTimeIntervals := MergeTimeIntervals(
		a.MuteTimeIntervals,
		a.TimeIntervals,
		b.MuteTimeIntervals,
		b.TimeIntervals,
		opts.DedupSuffix,
	)
	return RenameResources{
		Receivers:     renamedReceivers,
		TimeIntervals: renamedTimeIntervals,
	}, nil
}

// MergeTimeIntervals merges existing and incoming time intervals and mute intervals, ensuring unique names by applying suffixes.
// It returns a merged list of time intervals and a map of renamed interval names for tracking adjustments made. Mute time intervals are converted to time intervals.
func MergeTimeIntervals(
	existingMuteIntervals []config.MuteTimeInterval,
	existingTimeIntervals []config.TimeInterval,
	incomingMuteIntervals []config.MuteTimeInterval,
	incomingTimeIntervals []config.TimeInterval,
	suffix string,
) ([]config.TimeInterval, map[string]string) {
	// combine all incoming intervals into a single list
	incomingAll := make([]config.TimeInterval, 0, len(incomingTimeIntervals)+len(incomingMuteIntervals))
	incomingAll = append(incomingAll, incomingTimeIntervals...)
	for _, interval := range incomingMuteIntervals {
		incomingAll = append(incomingAll, config.TimeInterval(interval))
	}
	usedNames := createIndexTimeIntervals(existingMuteIntervals, existingTimeIntervals, incomingAll)
	result := make([]config.TimeInterval, 0, len(existingTimeIntervals)+len(incomingMuteIntervals)+len(incomingTimeIntervals))
	result = append(result, existingTimeIntervals...)
	renames := make(map[string]string)
	for idx, interval := range incomingAll {
		curName := interval.Name
		if i, ok := usedNames[curName]; ok && i != idx { // if the name is already used by another interval, append a suffix.
			newName := getUniqueName(curName, suffix, usedNames)
			renames[curName] = newName
			usedNames[newName] = idx
			interval.Name = newName
		}
		result = append(result, interval)
	}
	return result, renames
}

func createIndexTimeIntervals(
	existingMuteIntervals []config.MuteTimeInterval,
	existingTimeIntervals []config.TimeInterval,
	incomingTimeIntervals []config.TimeInterval,
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

func MergeRoutes(a, b definition.Route, matcher config.Matchers) *definition.Route {
	// get a and b by value so we get shallow copies of the top level routes, which we can modify.
	// make sure "b" route has all defaults set explicitly to avoid inheriting "a"'s default route settings.
	defaultOpts := dispatch.DefaultRouteOpts
	if b.GroupWait == nil {
		gw := model.Duration(defaultOpts.GroupWait)
		b.GroupWait = &gw
	}
	if b.GroupInterval == nil {
		gi := model.Duration(defaultOpts.GroupInterval)
		b.GroupInterval = &gi
	}
	if b.RepeatInterval == nil {
		ri := model.Duration(defaultOpts.RepeatInterval)
		b.RepeatInterval = &ri
	}
	b.Matchers = append(b.Matchers, matcher...)
	a.Routes = append([]*definition.Route{&b}, a.Routes...)
	return &a
}

func checkIfMatchersUsed(matchers config.Matchers, routes []*definition.Route) (bool, error) {
	// matchers are always equality type. So we can confidently convert them to labelsSet
	// and check if they are contained in any of the routes.
	ls := make(model.LabelSet, len(matchers))
	for _, matcher := range matchers {
		ls[model.LabelName(matcher.Name)] = model.LabelValue(matcher.Value)
	}
	for _, r := range routes {
		if r == nil {
			continue
		}
		m, err := r.AllMatchers()
		if err != nil {
			return false, err
		}
		if (labels.Matchers(m)).Matches(ls) {
			return true, nil
		}

		sameNames := make(labels.Matchers, 0, len(ls))
		seenNames := make(map[string]struct{}, len(ls))
		for _, matcher := range m {
			if _, ok := ls[model.LabelName(matcher.Name)]; ok {
				sameNames = append(sameNames, matcher)
				seenNames[matcher.Name] = struct{}{}
			}
		}
		// if the route contains matchers that match ALL labels, then check if sub-matchers will match them.
		if len(seenNames) == len(ls) && sameNames.Matches(ls) {
			return true, nil
		}
	}
	return false, nil
}

// RenameResourceUsagesInRoutes updates the receiver and mute/active time intervals of routes based on the provided rename resources.
func RenameResourceUsagesInRoutes(routes []*definition.Route, renames RenameResources) {
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

func MergeInhibitRules(a, b []config.InhibitRule, matcher config.Matchers) []config.InhibitRule {
	result := make([]config.InhibitRule, 0, len(a)+len(b))
	result = append(result, a...)
	for _, rule := range b {
		rule.SourceMatchers = append(rule.SourceMatchers, matcher...)
		rule.TargetMatchers = append(rule.TargetMatchers, matcher...)
		result = append(result, rule)
	}
	return result
}

// MergeReceivers merges two lists of PostableApiReceiver objects, ensuring unique names by appending a suffix if necessary.
// It returns the combined list of receivers and a map of renamed original names to their new unique names.
// The items of the existing list are added to the result list as is whereas the items of incoming list are copied (shallow copy)
// and renamed if necessary.
func MergeReceivers(existing, incoming []*definition.PostableApiReceiver, suffix string) ([]*definition.PostableApiReceiver, map[string]string) {
	result := make([]*definition.PostableApiReceiver, 0, len(existing)+len(incoming))
	result = append(result, existing...)
	usedNames := createIndexReceivers(existing, incoming)
	renames := make(map[string]string)
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
		result = append(result, &cpy)
	}
	return result, renames
}

func createIndexReceivers(existing, incoming []*definition.PostableApiReceiver) map[string]int {
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

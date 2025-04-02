package schedule

import (
	"cmp"
	"slices"
	"strings"

	models "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// sequence represents a chain of rules that should be evaluated in order.
// It is a convience type that wraps readyToRunItem as an indicator of what
// is being represented.
type sequence readyToRunItem

type groupKey struct {
	folderTitle string
	folderUID   string
	groupName   string
}

// buildSequences organizes rules into evaluation sequences where rules in the same group
// are chained together. The first rule in each group will trigger the evaluation of subsequent
// rules in that group through the afterEval callback.
//
// For example, if we have rules A, B, C in group G1 and rules D, E in group G2:
// - A will have afterEval set to evaluate B
// - B will have afterEval set to evaluate C
// - D will have afterEval set to evaluate E
//
// The function returns a slice of sequences, where each sequence represents a chain of rules
// that should be evaluated in order.
//
// NOTE: This currently only chains rules in imported groups.
func (sch *schedule) buildSequences(items []readyToRunItem, runJobFn func(next readyToRunItem, prev ...readyToRunItem) func()) []sequence {
	// Step 1: Group rules by their folder and group name
	groups := map[groupKey][]readyToRunItem{}
	var keys []groupKey
	for _, item := range items {
		g := groupKey{
			folderTitle: item.folderTitle,
			folderUID:   item.rule.NamespaceUID,
			groupName:   item.rule.RuleGroup,
		}
		i, ok := groups[g]
		if !ok {
			keys = append(keys, g)
		}
		groups[g] = append(i, item)
	}

	// Step 2: Sort group keys to ensure consistent ordering
	slices.SortFunc(keys, func(a, b groupKey) int {
		return cmp.Or(
			cmp.Compare(a.folderTitle, b.folderTitle),
			cmp.Compare(a.folderUID, b.folderUID),
			cmp.Compare(a.groupName, b.groupName),
		)
	})

	// Step 3: Build evaluation sequences for each group
	result := make([]sequence, 0, len(items))
	for _, key := range keys {
		groupItems := groups[key]

		if sch.shouldEvaluateSequentially(groupItems) {
			result = append(result, sch.buildSequence(key, groupItems, runJobFn))
			continue
		}

		for _, item := range groupItems {
			result = append(result, sequence(item))
		}
	}

	// sort the sequences by UID
	slices.SortFunc(result, func(a, b sequence) int {
		return strings.Compare(a.rule.UID, b.rule.UID)
	})

	return result
}

func (sch *schedule) buildSequence(groupKey groupKey, groupItems []readyToRunItem, runJobFn func(next readyToRunItem, prev ...readyToRunItem) func()) sequence {
	if len(groupItems) < 2 {
		return sequence(groupItems[0])
	}

	slices.SortFunc(groupItems, func(a, b readyToRunItem) int {
		return models.RulesGroupComparer(a.rule, b.rule)
	})

	// iterate over the group items backwards to set the afterEval callback
	for i := len(groupItems) - 2; i >= 0; i-- {
		groupItems[i].Evaluation.afterEval = runJobFn(groupItems[i+1], groupItems[i])
	}

	uids := make([]string, 0, len(groupItems))
	for _, item := range groupItems {
		uids = append(uids, item.rule.UID)
	}
	sch.log.Debug("Sequence created", "folder", groupKey.folderTitle, "group", groupKey.groupName, "sequence", strings.Join(uids, "->"))

	return sequence(groupItems[0])
}

func (sch *schedule) shouldEvaluateSequentially(groupItems []readyToRunItem) bool {
	// if jitter by rule is enabled, we can't evaluate rules sequentially
	if sch.jitterEvaluations == JitterByRule {
		return false
	}

	// if there is only one rule, there are no rules to chain
	if len(groupItems) == 1 {
		return false
	}

	// only evaluate rules in imported groups sequentially
	for _, item := range groupItems {
		if item.rule.ImportedFromPrometheus() {
			return true
		}
	}

	// default to false
	return false
}

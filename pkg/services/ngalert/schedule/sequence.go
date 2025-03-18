package schedule

import (
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

func cmp(a, b groupKey) int {
	if a.folderTitle < b.folderTitle {
		return -1
	}
	if a.folderTitle > b.folderTitle {
		return 1
	}
	if a.folderUID < b.folderUID {
		return -1
	}
	if a.folderUID > b.folderUID {
		return 1
	}
	if a.groupName < b.groupName {
		return -1
	}
	if a.groupName > b.groupName {
		return 1
	}
	return 0
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
	slices.SortFunc(keys, cmp)

	// Step 3: Build evaluation sequences for each group
	result := make([]sequence, 0, len(items))
	for _, key := range keys {
		groupItems := groups[key]

		// If there's only one rule in the group, no need to build a sequence
		if len(groupItems) == 1 {
			result = append(result, sequence(groupItems[0]))
			continue
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
		sch.log.Debug("Sequence created", "folder", key.folderTitle, "group", key.groupName, "sequence", strings.Join(uids, "->"))

		result = append(result, sequence(groupItems[0]))
	}

	// sort the sequences by UID
	slices.SortFunc(result, func(a, b sequence) int {
		return strings.Compare(a.rule.UID, b.rule.UID)
	})

	return result
}

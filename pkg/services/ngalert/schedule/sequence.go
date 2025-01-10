package schedule

import (
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type groupKey struct {
	folderTitle string
	folderUID   string
	groupName   string
}

func compare(a, b groupKey) int {
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

func (sch *schedule) buildSequences(items []readyToRunItem) []readyToRunItem {
	result := make([]readyToRunItem, 0, len(items))
	// group all rules that should be evaluated at the current tick.
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
	slices.SortFunc(keys, compare)
	for _, key := range keys {
		groupItems := groups[key]
		if len(groupItems) == 1 {
			result = append(result, groupItems[0]) // leave only the first item in the chain
			continue
		}
		slices.SortFunc(groupItems, func(a, b readyToRunItem) int {
			return models.RulesGroupComparer(a.rule, b.rule)
		})
		// going backwards because readyToRunItem is passed by value to runJobFn
		for i := len(groupItems) - 2; i >= 0; i-- {
			groupItems[i].Evaluation.afterEval = sch.runJobFn(groupItems[i+1])
		}
		uids := make([]string, 0, len(groupItems))
		for _, item := range groupItems {
			uids = append(uids, item.rule.UID)
		}
		result = append(result, groupItems[0]) // leave only the first item in the chain
		sch.log.Debug("Sequence created", "folder", key.folderTitle, "group", key.groupName, "sequence", strings.Join(uids, "->"))
	}
	return result
}

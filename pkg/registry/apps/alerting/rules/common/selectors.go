package common

import (
	"fmt"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// ParseLabelSelectorFilter extracts a ListRuleStringFilter from a label selector for a specific key.
// It supports Equals/In operators for include, NotEquals/NotIn for exclude, and Exists/DoesNotExist for presence filtering.
func ParseLabelSelectorFilter(selector labels.Selector, key string) (provisioning.ListRuleStringFilter, error) {
	filter := provisioning.ListRuleStringFilter{}
	if selector == nil || selector.Empty() {
		return filter, nil
	}
	reqs, selectable := selector.Requirements()
	if !selectable {
		return filter, nil
	}
	for _, req := range reqs {
		if req.Key() != key {
			continue
		}
		vals := req.Values()
		switch req.Operator() {
		case selection.Equals, selection.DoubleEquals, selection.In:
			filter.Include = vals.UnsortedList()
		case selection.NotEquals, selection.NotIn:
			filter.Exclude = vals.UnsortedList()
		case selection.Exists:
			t := true
			filter.Exists = &t
		case selection.DoesNotExist:
			f := false
			filter.Exists = &f
		default:
			return filter, fmt.Errorf("unsupported operator %q", req.Operator())
		}
	}
	return filter, nil
}

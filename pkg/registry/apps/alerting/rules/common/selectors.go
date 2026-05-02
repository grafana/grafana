package common

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// ListMode signals that a label selector matches one of the special list modes that unified
// storage exposes via reserved labels (history / trash). Legacy storage implementations need
// to translate those into domain-specific lookups so the same client can target either backend.
type ListMode int

const (
	ListModeNormal ListMode = iota
	ListModeHistory
	ListModeTrash
)

// ParseListMode inspects a label selector for the reserved grafana.app/get-history and
// grafana.app/get-trash labels (see pkg/apimachinery/utils.LabelKey*). When one of those labels
// is present the selector is required to be a single equality requirement set to "true", which
// matches the contract enforced by unified storage in pkg/storage/unified/apistore/util.go.
//
// For history requests, the resource name is taken from the metadata.name field selector to mirror
// unified storage which requires the name to identify the rule whose history to return.
func ParseListMode(labelSelector labels.Selector, fieldSelector fields.Selector) (ListMode, string, error) {
	if labelSelector == nil || labelSelector.Empty() {
		return ListModeNormal, "", nil
	}
	reqs, selectable := labelSelector.Requirements()
	if !selectable {
		return ListModeNormal, "", nil
	}

	var mode ListMode
	var matched string
	for _, r := range reqs {
		key := r.Key()
		if key != utils.LabelKeyGetHistory && key != utils.LabelKeyGetTrash {
			continue
		}
		if len(reqs) != 1 {
			return ListModeNormal, "", fmt.Errorf("single label supported with: %s", key)
		}
		if r.Operator() != selection.Equals && r.Operator() != selection.DoubleEquals {
			return ListModeNormal, "", fmt.Errorf("only = operator supported with: %s", key)
		}
		vals := r.Values().List()
		if len(vals) != 1 || vals[0] != "true" {
			return ListModeNormal, "", fmt.Errorf("expecting true for: %s", key)
		}
		matched = key
		switch key {
		case utils.LabelKeyGetTrash:
			mode = ListModeTrash
		case utils.LabelKeyGetHistory:
			mode = ListModeHistory
		}
	}

	if mode == ListModeNormal {
		return ListModeNormal, "", nil
	}

	if mode != ListModeHistory {
		return mode, "", nil
	}

	if fieldSelector == nil || fieldSelector.Empty() {
		return ListModeNormal, "", fmt.Errorf("metadata.name field selector required for: %s", matched)
	}
	fieldReqs := fieldSelector.Requirements()
	if len(fieldReqs) != 1 || fieldReqs[0].Field != "metadata.name" {
		return ListModeNormal, "", fmt.Errorf("metadata.name field selector required for: %s", matched)
	}
	return ListModeHistory, fieldReqs[0].Value, nil
}

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

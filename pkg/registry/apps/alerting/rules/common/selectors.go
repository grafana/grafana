package common

import (
	"fmt"
	"slices"
	"strconv"

	"k8s.io/apimachinery/pkg/fields"
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

// ValidateInt64String returns a validator that checks the value parses as a base-10 int64.
func ValidateInt64String(field string) func(string) error {
	return func(v string) error {
		if _, err := strconv.ParseInt(v, 10, 64); err != nil {
			return fmt.Errorf("invalid value for %s: %s", field, v)
		}
		return nil
	}
}

// ValidateOneOf returns a validator that checks the value is in the provided allowlist.
func ValidateOneOf(field string, allowed []string) func(string) error {
	return func(v string) error {
		if !slices.Contains(allowed, v) {
			return fmt.Errorf("invalid value for %s: %s (expected one of %v)", field, v, allowed)
		}
		return nil
	}
}

// AccumulateFieldSelectorFilter accumulates the value from a single field-selector requirement
// into the given filter. Multiple `=`/`==` requirements for the same field are bucketed into the
// Include slice (interpreted as IN); multiple `!=` requirements are bucketed into Exclude
// (NOT IN). Field selectors only support these three operators in upstream k8s. The validate
// callback, when non-nil, is run on each value before it is appended.
func AccumulateFieldSelectorFilter(filter *provisioning.ListRuleStringFilter, req fields.Requirement, validate func(string) error) error {
	if validate != nil {
		if err := validate(req.Value); err != nil {
			return err
		}
	}
	switch req.Operator {
	case selection.Equals, selection.DoubleEquals:
		filter.Include = append(filter.Include, req.Value)
	case selection.NotEquals:
		filter.Exclude = append(filter.Exclude, req.Value)
	default:
		return fmt.Errorf("unsupported operator %q for field %q (only =, ==, != are supported)", req.Operator, req.Field)
	}
	return nil
}

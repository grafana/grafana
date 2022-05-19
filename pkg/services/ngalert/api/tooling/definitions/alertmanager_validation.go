package definitions

import (
	"fmt"
	"time"

	"github.com/prometheus/common/model"
)

// Validate normalizes a possibly nested Route r, and returns errors if r is invalid.
func (r *Route) validateChild() error {
	r.GroupBy = nil
	r.GroupByAll = false
	for _, l := range r.GroupByStr {
		if l == "..." {
			r.GroupByAll = true
		} else {
			r.GroupBy = append(r.GroupBy, model.LabelName(l))
		}
	}

	if len(r.GroupBy) > 0 && r.GroupByAll {
		return fmt.Errorf("cannot have wildcard group_by (`...`) and other other labels at the same time")
	}

	groupBy := map[model.LabelName]struct{}{}

	for _, ln := range r.GroupBy {
		if _, ok := groupBy[ln]; ok {
			return fmt.Errorf("duplicated label %q in group_by, %s %s", ln, r.Receiver, r.GroupBy)
		}
		groupBy[ln] = struct{}{}
	}

	if r.GroupInterval != nil && time.Duration(*r.GroupInterval) == time.Duration(0) {
		return fmt.Errorf("group_interval cannot be zero")
	}
	if r.RepeatInterval != nil && time.Duration(*r.RepeatInterval) == time.Duration(0) {
		return fmt.Errorf("repeat_interval cannot be zero")
	}

	// Routes are a self-referential structure.
	if r.Routes != nil {
		for _, child := range r.Routes {
			err := child.validateChild()
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// Validate normalizes a Route r, and returns errors if r is an invalid root route. Root routes must satisfy a few additional conditions.
func (r *Route) Validate() error {
	if len(r.Receiver) == 0 {
		return fmt.Errorf("root route must specify a default receiver")
	}
	if len(r.Match) > 0 || len(r.MatchRE) > 0 {
		return fmt.Errorf("root route must not have any matchers")
	}
	if len(r.MuteTimeIntervals) > 0 {
		return fmt.Errorf("root route must not have any mute time intervals")
	}
	return r.validateChild()
}

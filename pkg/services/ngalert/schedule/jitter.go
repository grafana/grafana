package schedule

import (
	"fmt"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/prometheus/model/labels"
)

// jitterOffsetInTicks gives the jitter offset for a rule, in terms of a number of ticks relative to its interval and a base interval.
// The resulting number of ticks is non-negative.
func jitterOffsetInTicks(r *ngmodels.AlertRule, baseInterval time.Duration) int64 {
	itemFrequency := r.IntervalSeconds / int64(baseInterval.Seconds())
	offset := jitterHash(r) % uint64(itemFrequency)
	// Offset is always nonnegative and less than int64.max, because above we mod by itemFrequency which fits in the positive half of int64.
	// offset <= itemFrequency <= int64.max
	// So, this will not overflow and produce a negative offset.
	//
	// Regardless, take an absolute value anyway for an extra layer of safety in case the above logic ever changes.
	// Our contract requires that the result is nonnegative and less than int64.max.
	res := int64(offset)
	if res < 0 {
		return -res
	}
	return res
}

func jitterHash(r *ngmodels.AlertRule) uint64 {
	l := labels.New(
		labels.Label{Name: "name", Value: r.RuleGroup},
		labels.Label{Name: "file", Value: r.NamespaceUID},
		labels.Label{Name: "orgId", Value: fmt.Sprint(r.OrgID)},
	)
	// Labels hash is not guaranteed to be the same across different runs of prom.
	// Perhaps we should use a stable hash, for grafana HA mode?
	return l.Hash()
}

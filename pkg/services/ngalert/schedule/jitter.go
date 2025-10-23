package schedule

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

// JitterStrategy represents a modifier to alert rule timing that affects how evaluations are distributed.
type JitterStrategy int

const (
	JitterNever JitterStrategy = iota
	JitterByGroup
	JitterByRule
)

// JitterStrategyFrom returns the JitterStrategy indicated by the current Grafana feature toggles.
func JitterStrategyFrom(cfg setting.UnifiedAlertingSettings, toggles featuremgmt.FeatureToggles) JitterStrategy {
	strategy := JitterByGroup
	if cfg.DisableJitter {
		return JitterNever
	}
	if toggles == nil {
		return strategy
	}
	//nolint:staticcheck // using deprecated FFS service for backward compatibility
	if toggles.IsEnabledGlobally(featuremgmt.FlagJitterAlertRulesWithinGroups) {
		strategy = JitterByRule
	}
	return strategy
}

// jitterOffsetInTicks gives the jitter offset for a rule, in terms of a number of ticks relative to its interval and a base interval.
// The resulting number of ticks is non-negative. We assume the rule is well-formed and has an IntervalSeconds greater to or equal than baseInterval.
func jitterOffsetInTicks(r *ngmodels.AlertRule, baseInterval time.Duration, strategy JitterStrategy) int64 {
	if strategy == JitterNever {
		return 0
	}

	itemFrequency := r.IntervalSeconds / int64(baseInterval.Seconds())
	offset := jitterHash(r, strategy) % uint64(itemFrequency)
	// Offset is always nonnegative and less than int64.max, because above we mod by itemFrequency which fits in the positive half of int64.
	// offset <= itemFrequency <= int64.max
	// So, this will not overflow and produce a negative offset.
	res := int64(offset)

	// Regardless, take an absolute value anyway for an extra layer of safety in case the above logic ever changes.
	// Our contract requires that the result is nonnegative and less than int64.max.
	if res < 0 {
		return -res
	}
	return res
}

func jitterHash(r *ngmodels.AlertRule, strategy JitterStrategy) uint64 {
	ls := data.Labels{
		"name":  r.RuleGroup,
		"file":  r.NamespaceUID,
		"orgId": fmt.Sprint(r.OrgID),
	}

	if strategy == JitterByRule {
		ls["uid"] = r.UID
	}
	return uint64(ls.Fingerprint())
}

package v0alpha1

import (
	"fmt"
	"slices"
	"time"
)

func (o *AlertRule) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ProvenanceStatusNone
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok {
		return ProvenanceStatusNone
	}

	return s
}

func (o *AlertRule) SetProvenanceStatus(status string) (err error) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if !slices.Contains(AcceptedProvenanceStatuses, status) {
		return fmt.Errorf("invalid provenance status: %s", status)
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
	return
}

// HACK: these should be unnecessary based on the openapi schema generation
const (
	DefaultNoDataState  = "NoData"
	DefaultExecErrState = "Error"
)

func (s *AlertRuleSpec) NoDataStateOrDefault() string {
	if s.NoDataState == "" {
		return DefaultNoDataState
	}
	return s.NoDataState
}

func (s *AlertRuleSpec) ExecErrStateOrDefault() string {
	if s.ExecErrState == "" {
		return DefaultExecErrState
	}
	return s.ExecErrState
}

func (d *AlertRulePromDuration) ToDuration() (time.Duration, error) {
	return ToDuration(string(*d))
}

func (d *AlertRulePromDurationWMillis) ToDuration() (time.Duration, error) {
	return ToDuration(string(*d))
}

func (d *AlertRulePromDuration) Clamp() error {
	clampedDuration, err := ClampDuration(string(*d))
	if err != nil {
		return err
	}
	*d = AlertRulePromDuration(clampedDuration)
	return nil
}

func (d *AlertRulePromDurationWMillis) Clamp() error {
	clampedDuration, err := ClampDuration(string(*d))
	if err != nil {
		return err
	}
	*d = AlertRulePromDurationWMillis(clampedDuration)
	return nil
}

func (spec *AlertRuleSpec) ClampDurations() error {
	// clamp all duration fields
	if err := spec.Trigger.Interval.Clamp(); err != nil {
		return err
	}
	if spec.For != nil {
		clamped, err := ClampDuration(*spec.For)
		if err != nil {
			return err
		}
		spec.For = &clamped
	}
	if spec.KeepFiringFor != nil {
		clamped, err := ClampDuration(*spec.KeepFiringFor)
		if err != nil {
			return err
		}
		spec.KeepFiringFor = &clamped
	}
	if spec.NotificationSettings != nil {
		if spec.NotificationSettings.GroupWait != nil {
			if err := spec.NotificationSettings.GroupWait.Clamp(); err != nil {
				return err
			}
		}
		if spec.NotificationSettings.GroupInterval != nil {
			if err := spec.NotificationSettings.GroupInterval.Clamp(); err != nil {
				return err
			}
		}
		if spec.NotificationSettings.RepeatInterval != nil {
			if err := spec.NotificationSettings.RepeatInterval.Clamp(); err != nil {
				return err
			}
		}
	}
	for k, expr := range spec.Expressions {
		if expr.RelativeTimeRange != nil {
			if err := expr.RelativeTimeRange.From.Clamp(); err != nil {
				return err
			}
			if err := expr.RelativeTimeRange.To.Clamp(); err != nil {
				return err
			}
			spec.Expressions[k] = expr
		}
	}
	return nil
}

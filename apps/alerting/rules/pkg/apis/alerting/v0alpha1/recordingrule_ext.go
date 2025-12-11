package v0alpha1

import (
	"fmt"
	"slices"
	"time"
)

func (o *RecordingRule) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ProvenanceStatusNone
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok {
		return ProvenanceStatusNone
	}
	return s
}

func (o *RecordingRule) SetProvenanceStatus(status string) (err error) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if !slices.Contains(AcceptedProvenanceStatuses, status) {
		return fmt.Errorf("invalid provenance status: %s", status)
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
	return
}

func (d *RecordingRulePromDuration) ToDuration() (time.Duration, error) {
	return ToDuration(string(*d))
}

func (d *RecordingRulePromDurationWMillis) ToDuration() (time.Duration, error) {
	return ToDuration(string(*d))
}

func (d *RecordingRulePromDuration) Clamp() error {
	clampedDuration, err := ClampDuration(string(*d))
	if err != nil {
		return err
	}
	*d = RecordingRulePromDuration(clampedDuration)
	return nil
}

func (d *RecordingRulePromDurationWMillis) Clamp() error {
	clampedDuration, err := ClampDuration(string(*d))
	if err != nil {
		return err
	}
	*d = RecordingRulePromDurationWMillis(clampedDuration)
	return nil
}

func (spec *RecordingRuleSpec) ClampDurations() error {
	// clamp all duration fields
	if err := spec.Trigger.Interval.Clamp(); err != nil {
		return err
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

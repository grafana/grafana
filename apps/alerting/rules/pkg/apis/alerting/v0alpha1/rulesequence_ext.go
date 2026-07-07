package v0alpha1

import (
	"fmt"
	"slices"
	"time"
)

func (o *RuleSequence) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ProvenanceStatusNone
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok {
		return ProvenanceStatusNone
	}
	return s
}

func (o *RuleSequence) SetProvenanceStatus(status string) (err error) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if !slices.Contains(AcceptedProvenanceStatuses, status) {
		return fmt.Errorf("invalid provenance status: %s", status)
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
	return
}

func (d *RuleSequencePromDuration) ToDuration() (time.Duration, error) {
	return ToDuration(string(*d))
}

func (d *RuleSequencePromDuration) Clamp() error {
	clampedDuration, err := ClampDuration(string(*d))
	if err != nil {
		return err
	}
	*d = RuleSequencePromDuration(clampedDuration)
	return nil
}

func (spec *RuleSequenceSpec) ClampDurations() error {
	return spec.Trigger.Interval.Clamp()
}

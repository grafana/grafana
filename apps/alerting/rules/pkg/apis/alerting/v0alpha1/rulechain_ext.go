package v0alpha1

import (
	"fmt"
	"slices"
	"time"
)

func (o *RuleChain) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ProvenanceStatusNone
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok {
		return ProvenanceStatusNone
	}
	return s
}

func (o *RuleChain) SetProvenanceStatus(status string) (err error) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if !slices.Contains(AcceptedProvenanceStatuses, status) {
		return fmt.Errorf("invalid provenance status: %s", status)
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
	return
}

func (d *RuleChainPromDuration) ToDuration() (time.Duration, error) {
	return ToDuration(string(*d))
}

func (d *RuleChainPromDuration) Clamp() error {
	clampedDuration, err := ClampDuration(string(*d))
	if err != nil {
		return err
	}
	*d = RuleChainPromDuration(clampedDuration)
	return nil
}

func (spec *RuleChainSpec) ClampDurations() error {
	return spec.Trigger.Interval.Clamp()
}

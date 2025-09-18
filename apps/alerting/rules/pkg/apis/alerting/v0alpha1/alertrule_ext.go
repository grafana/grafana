package v0alpha1

import (
	"fmt"
	"slices"
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

// TODO: add duration clamping for the field types AlertRulePromDuration, AlertRulePromDurationWMillis, and the For and KeepFiringFor string pointers

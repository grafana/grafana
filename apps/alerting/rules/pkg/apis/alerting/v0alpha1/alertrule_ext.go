package v0alpha1

func (o *AlertRule) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return ProvenanceStatusNone
	}
	return s
}

func (o *AlertRule) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = ProvenanceStatusNone
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
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

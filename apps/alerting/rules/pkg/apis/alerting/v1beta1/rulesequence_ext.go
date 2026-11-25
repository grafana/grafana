package v1beta1

import (
	"fmt"
	"net/http"
	"slices"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CauseTypeRuleSequenceMember is the status cause of a rule delete rejected because the rule
// still belongs to a rule sequence. Callers that own the sequence match on it to retry once
// they have removed the rule from the sequence.
const CauseTypeRuleSequenceMember metav1.CauseType = "RuleSequenceMember"

// NewRuleSequenceMemberError rejects deleting a rule that belongs to a rule sequence.
func NewRuleSequenceMemberError(ruleUID, sequenceUID string) error {
	msg := fmt.Sprintf("cannot delete rule %q because it belongs to rule sequence %q", ruleUID, sequenceUID)
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusForbidden,
		Reason:  metav1.StatusReasonForbidden,
		Message: msg,
		Details: &metav1.StatusDetails{
			Name:   ruleUID,
			Causes: []metav1.StatusCause{{Type: CauseTypeRuleSequenceMember, Message: msg}},
		},
	}}
}

// IsRuleSequenceMemberError reports whether err is a rule delete rejected by NewRuleSequenceMemberError.
func IsRuleSequenceMemberError(err error) bool {
	return apierrors.HasStatusCause(err, CauseTypeRuleSequenceMember)
}

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

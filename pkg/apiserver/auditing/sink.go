package auditing

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// TODO this should be configurable...
type PolicyRuleEvaluator struct {
	// cfg *setting.Cfg
}

var _ audit.PolicyRuleEvaluator = &PolicyRuleEvaluator{}

func (PolicyRuleEvaluator) EvaluatePolicyRule(attrs authorizer.Attributes) audit.RequestAuditConfig {
	// Skip watch requests otherwise it is too noisy.
	if attrs.GetVerb() == utils.VerbWatch {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	return audit.RequestAuditConfig{
		Level: auditinternal.LevelMetadata,
		OmitStages: []auditinternal.Stage{
			auditinternal.StageRequestReceived,
			auditinternal.StageResponseStarted,
			auditinternal.StagePanic,
		},
		OmitManagedFields: true,
	}
}

type GrafanaBackend struct {
	logger Logger
}

func NewGrafanaBackend(logger Logger) audit.Backend {
	return &GrafanaBackend{logger}
}

func (b *GrafanaBackend) ProcessEvents(k8sEvents ...*auditinternal.Event) bool {
	for _, k8sEvent := range k8sEvents {
		event := Event{
			Namespace:  k8sEvent.ObjectRef.Namespace,
			ObservedAt: k8sEvent.StageTimestamp.Time,
			Subject:    k8sEvent.User.UID,
			Verb:       k8sEvent.Verb,
			Object:     k8sEvent.ObjectRef.Name,
			APIGroup:   k8sEvent.ObjectRef.APIGroup,
			APIVersion: k8sEvent.ObjectRef.APIVersion,
			Kind:       k8sEvent.ObjectRef.Resource,
			Outcome:    b.outcomeFromStatus(k8sEvent.ResponseStatus),
			Extra: map[string]string{
				"auditID":   string(k8sEvent.AuditID),
				"userAgent": k8sEvent.UserAgent,
				"sourceIPs": strings.Join(k8sEvent.SourceIPs, ";"),
			},
		}

		err := b.logger.Log(event)
		if err != nil {
			return false
		}
	}

	return true
}

func (GrafanaBackend) Run(stopCh <-chan struct{}) error {
	return nil
}

func (GrafanaBackend) Shutdown() {
}

func (GrafanaBackend) String() string {
	return "grafana-audit-log"
}

func (GrafanaBackend) outcomeFromStatus(status *metav1.Status) EventOutcome {
	if status == nil {
		return EventOutcomeUnknown
	}

	switch status.Code {
	case http.StatusUnauthorized, http.StatusForbidden:
		return EventOutcomeFailureUnauthorized
	case http.StatusNotFound:
		return EventOutcomeFailureNotFound
	}

	if status.Code >= http.StatusBadRequest {
		return EventOutcomeFailureGeneric
	}

	return EventOutcomeSuccess
}

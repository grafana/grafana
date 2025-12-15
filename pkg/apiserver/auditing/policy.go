package auditing

import (
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"k8s.io/apimachinery/pkg/runtime/schema"
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// PolicyRuleEvaluators is a map of API group+version to audit.PolicyRuleEvaluator
type PolicyRuleEvaluators = map[schema.GroupVersion]audit.PolicyRuleEvaluator

type PolicyRuleProvider interface {
	PolicyRuleProvider(evaluators PolicyRuleEvaluators) audit.PolicyRuleEvaluator
}

// PolicyRuleEvaluator alias for easier imports.
type PolicyRuleEvaluator = audit.PolicyRuleEvaluator

// DefaultGrafanaPolicyRuleEvaluator provides a sane default configuration for audit logging for API group+versions.
type defaultGrafanaPolicyRuleEvaluator struct{}

var _ PolicyRuleEvaluator = &defaultGrafanaPolicyRuleEvaluator{}

func NewDefaultGrafanaPolicyRuleEvaluator() audit.PolicyRuleEvaluator {
	return defaultGrafanaPolicyRuleEvaluator{}
}

func (defaultGrafanaPolicyRuleEvaluator) EvaluatePolicyRule(attrs authorizer.Attributes) audit.RequestAuditConfig {
	// Skip non-resource and watch requests otherwise it is too noisy.
	if !attrs.IsResourceRequest() || attrs.GetVerb() == utils.VerbWatch {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	// Skip auditing if the user is part of the privileged group.
	// The loopback client uses this group, so requests initiated in `/api/` would be duplicated.
	if u := attrs.GetUser(); u != nil && slices.Contains(u.GetGroups(), user.SystemPrivilegedGroup) {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	return audit.RequestAuditConfig{
		Level: auditinternal.LevelMetadata,
		OmitStages: []auditinternal.Stage{
			// Only log on StageResponseComplete
			auditinternal.StageRequestReceived,
			auditinternal.StageResponseStarted,
			auditinternal.StagePanic,
		},
		OmitManagedFields: false, // Setting it to true causes extra copying/unmarshalling.
	}
}

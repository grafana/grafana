package auditing

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/audit"
)

// PolicyRuleEvaluators is a map of API group+version to audit.PolicyRuleEvaluator
type PolicyRuleEvaluators = map[schema.GroupVersion]audit.PolicyRuleEvaluator

type PolicyRuleProvider interface {
	PolicyRuleProvider(evaluators PolicyRuleEvaluators) audit.PolicyRuleEvaluator
}

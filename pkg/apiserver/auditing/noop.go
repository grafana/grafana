package auditing

import (
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// NoopBackend is a no-op implementation of audit.Backend
type NoopBackend struct{}

func ProvideNoopBackend() audit.Backend { return &NoopBackend{} }

func (b *NoopBackend) ProcessEvents(k8sEvents ...*auditinternal.Event) bool { return false }

func (NoopBackend) Run(stopCh <-chan struct{}) error { return nil }

func (NoopBackend) Shutdown() {}

func (NoopBackend) String() string { return "" }

// NoopPolicyRuleEvaluator is a no-op implementation of audit.PolicyRuleEvaluator
type NoopPolicyRuleEvaluator struct{}

func ProvideNoopPolicyRuleEvaluator() audit.PolicyRuleEvaluator { return &NoopPolicyRuleEvaluator{} }

func (NoopPolicyRuleEvaluator) EvaluatePolicyRule(authorizer.Attributes) audit.RequestAuditConfig {
	return audit.RequestAuditConfig{Level: auditinternal.LevelNone}
}

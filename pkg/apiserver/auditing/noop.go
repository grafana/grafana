package auditing

import (
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// NoopBackend is a no-op implementation of audit.Backend
type NoopBackend struct{}

func ProvideNoopBackend() audit.Backend { return &NoopBackend{} }

func (NoopBackend) ProcessEvents(...*auditinternal.Event) bool { return false }

func (NoopBackend) Run(<-chan struct{}) error { return nil }

func (NoopBackend) Shutdown() {}

func (NoopBackend) String() string { return "" }

// NoopPolicyRuleProvider is a no-op implementation of PolicyRuleProvider
type NoopPolicyRuleProvider struct{}

func ProvideNoopPolicyRuleProvider() PolicyRuleProvider { return &NoopPolicyRuleProvider{} }

func (NoopPolicyRuleProvider) PolicyRuleProvider(PolicyRuleEvaluators) audit.PolicyRuleEvaluator {
	return NoopPolicyRuleEvaluator{}
}

// NoopPolicyRuleEvaluator is a no-op implementation of audit.PolicyRuleEvaluator
type NoopPolicyRuleEvaluator struct{}

func (NoopPolicyRuleEvaluator) EvaluatePolicyRule(authorizer.Attributes) audit.RequestAuditConfig {
	return audit.RequestAuditConfig{Level: auditinternal.LevelNone}
}

// NoopLogger is a no-op implementation of Logger
type NoopLogger struct{}

func ProvideNoopLogger() Logger { return &NoopLogger{} }

func (NoopLogger) Type() string { return "noop" }

func (NoopLogger) Log(Sinkable) error { return nil }

func (NoopLogger) Close() error { return nil }

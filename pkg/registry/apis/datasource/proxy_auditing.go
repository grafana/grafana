package datasource

import (
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apiserver/auditing"
)

func (b *DataSourceAPIBuilder) GetPolicyRuleEvaluator() auditing.PolicyRuleEvaluator {
	return proxyAuditPolicy{}
}

type proxyAuditPolicy struct{}

func (proxyAuditPolicy) EvaluatePolicyRule(attrs authorizer.Attributes) audit.RequestAuditConfig {
	if !attrs.IsResourceRequest() || attrs.GetResource() != "datasources" || attrs.GetSubresource() != "proxy" {
		return audit.RequestAuditConfig{Level: auditinternal.LevelNone}
	}
	// Proxy POSTs carry arbitrary upstream payloads, so never use request/response body auditing here.
	return audit.RequestAuditConfig{
		Level: auditinternal.LevelMetadata,
		OmitStages: []auditinternal.Stage{
			auditinternal.StageRequestReceived,
			auditinternal.StageResponseStarted,
		},
	}
}

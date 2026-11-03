package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestProxyAuditPolicy(t *testing.T) {
	policy := (&DataSourceAPIBuilder{}).GetPolicyRuleEvaluator()
	for _, verb := range []string{"get", "create", "update", "patch", "delete", "connect"} {
		t.Run(verb, func(t *testing.T) {
			cfg := policy.EvaluatePolicyRule(authorizer.AttributesRecord{
				ResourceRequest: true, Resource: "datasources", Subresource: "proxy", Verb: verb,
			})
			require.Equal(t, auditinternal.LevelMetadata, cfg.Level)
			require.NotContains(t, cfg.OmitStages, auditinternal.StageResponseComplete)
			require.NotContains(t, cfg.OmitStages, auditinternal.StagePanic)
		})
	}
	for _, attrs := range []authorizer.AttributesRecord{
		{ResourceRequest: false, Resource: "datasources", Subresource: "proxy"},
		{ResourceRequest: true, Resource: "other", Subresource: "proxy"},
		{ResourceRequest: true, Resource: "datasources", Subresource: "query"},
		{ResourceRequest: true, Resource: "datasources", Subresource: ""},
	} {
		require.Equal(t, auditinternal.LevelNone, policy.EvaluatePolicyRule(attrs).Level)
	}
}

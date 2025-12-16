package auditing_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/auditing"
	"github.com/stretchr/testify/require"
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestDefaultGrafanaPolicyRuleEvaluator(t *testing.T) {
	t.Parallel()

	evaluator := auditing.NewDefaultGrafanaPolicyRuleEvaluator()
	require.NotNil(t, evaluator)

	t.Run("returns audit level none for non-resource requests", func(t *testing.T) {
		t.Parallel()

		attrs := authorizer.AttributesRecord{
			ResourceRequest: false,
		}

		config := evaluator.EvaluatePolicyRule(attrs)
		require.Equal(t, auditinternal.LevelNone, config.Level)
	})

	t.Run("returns audit level none for watch requests", func(t *testing.T) {
		t.Parallel()

		attrs := authorizer.AttributesRecord{
			ResourceRequest: true,
			Verb:            utils.VerbWatch,
		}

		config := evaluator.EvaluatePolicyRule(attrs)
		require.Equal(t, auditinternal.LevelNone, config.Level)
	})

	t.Run("returns audit level none for requests from privileged group", func(t *testing.T) {
		t.Parallel()

		attrs := authorizer.AttributesRecord{
			ResourceRequest: true,
			Verb:            utils.VerbCreate,
			User: &user.DefaultInfo{
				Groups: []string{"test-group", user.SystemPrivilegedGroup},
			},
		}

		config := evaluator.EvaluatePolicyRule(attrs)
		require.Equal(t, auditinternal.LevelNone, config.Level)
	})

	t.Run("return audit level metadata for other resource requests", func(t *testing.T) {
		t.Parallel()

		attrs := authorizer.AttributesRecord{
			ResourceRequest: true,
			Verb:            utils.VerbCreate,
			User: &user.DefaultInfo{
				Name:   "test-user",
				Groups: []string{"test-group"},
			},
		}

		config := evaluator.EvaluatePolicyRule(attrs)
		require.Equal(t, auditinternal.LevelMetadata, config.Level)
	})
}

package rules

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
	"github.com/grafana/grafana/pkg/setting"
)

// The apiserver converts legacy objects starting from their TypeMeta, so the converters in legacy
// must stamp the same TypeMeta that the registry serves.
func TestLegacyConvertersUseRegistryTypeMeta(t *testing.T) {
	mapper := request.GetNamespaceMapper(&setting.Cfg{})
	gen := ngmodels.RuleGen

	alerting := gen.With(gen.WithOrgID(1)).GenerateRef()
	alerting.Record = nil
	ar, err := legacy.AlertRuleToK8s(1, alerting, utils.ManagerProperties{}, mapper)
	require.NoError(t, err)
	require.Equal(t, alertrule.ResourceInfo.TypeMeta(), ar.TypeMeta)

	recording := gen.With(gen.WithOrgID(1), gen.WithAllRecordingRules()).GenerateRef()
	rr, err := legacy.RecordingRuleToK8s(1, recording, utils.ManagerProperties{}, mapper)
	require.NoError(t, err)
	require.Equal(t, recordingrule.ResourceInfo.TypeMeta(), rr.TypeMeta)
}

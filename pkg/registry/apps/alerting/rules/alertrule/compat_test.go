package alertrule

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

func nsMapperForTest() request.NamespaceMapper {
	return request.GetNamespaceMapper(&setting.Cfg{})
}

func TestConvertVersionToK8sResource(t *testing.T) {
	mapper := nsMapperForTest()
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithOrgID(1)).GenerateRef()
	rule.Record = nil // ensure alerting type

	t.Run("converts and preserves the revision message", func(t *testing.T) {
		version := &ngmodels.AlertRuleVersion{AlertRule: *rule, Message: "edit reason"}
		got, err := convertVersionToK8sResource(rule.OrgID, version, mapper)
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, rule.UID, got.Name)

		meta, err := utils.MetaAccessor(got)
		require.NoError(t, err)
		assert.Equal(t, "edit reason", meta.GetMessage())
	})

	t.Run("nil version returns error", func(t *testing.T) {
		_, err := convertVersionToK8sResource(rule.OrgID, nil, mapper)
		require.Error(t, err)
	})

	t.Run("recording-rule version is rejected", func(t *testing.T) {
		recRule := gen.With(gen.WithOrgID(1), gen.WithAllRecordingRules()).GenerateRef()
		_, err := convertVersionToK8sResource(recRule.OrgID, &ngmodels.AlertRuleVersion{AlertRule: *recRule}, mapper)
		require.ErrorIs(t, err, errInvalidRule)
	})
}

func TestConvertVersionsToK8sResources_FiltersInvalid(t *testing.T) {
	mapper := nsMapperForTest()
	gen := ngmodels.RuleGen
	alerting := gen.With(gen.WithOrgID(1)).GenerateRef()
	alerting.Record = nil
	recording := gen.With(gen.WithOrgID(1), gen.WithAllRecordingRules()).GenerateRef()

	versions := []*ngmodels.AlertRuleVersion{
		{AlertRule: *alerting, Message: "v1"},
		{AlertRule: *recording, Message: "should be skipped"},
	}

	out, err := convertVersionsToK8sResources(1, versions, mapper)
	require.NoError(t, err)
	require.Len(t, out.Items, 1)
	assert.Equal(t, alerting.UID, out.Items[0].Name)
}

func TestConvertDeletedToK8sResources(t *testing.T) {
	mapper := nsMapperForTest()
	gen := ngmodels.RuleGen
	alerting := gen.With(gen.WithOrgID(1)).GenerateRef()
	alerting.Record = nil
	alerting.UID = ""             // tombstone leaves UID empty
	alerting.Updated = time.Now() // deletion time

	out, err := convertDeletedToK8sResources(1, []*ngmodels.AlertRule{alerting}, mapper)
	require.NoError(t, err)
	require.Len(t, out.Items, 1)
	got := out.Items[0]

	// Resource name falls back to GUID since the UID is gone.
	assert.Equal(t, alerting.GUID, got.Name)
	require.NotNil(t, got.DeletionTimestamp, "deleted rule should carry a deletion timestamp")
}

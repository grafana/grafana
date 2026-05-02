package recordingrule

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
	rule := gen.With(gen.WithOrgID(1), gen.WithAllRecordingRules()).GenerateRef()

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

	t.Run("alerting-rule version is rejected", func(t *testing.T) {
		alertRule := gen.With(gen.WithOrgID(1)).GenerateRef()
		alertRule.Record = nil
		_, err := convertVersionToK8sResource(alertRule.OrgID, &ngmodels.AlertRuleVersion{AlertRule: *alertRule}, mapper)
		require.ErrorIs(t, err, errInvalidRule)
	})
}

func TestConvertVersionsToK8sResources_FiltersInvalid(t *testing.T) {
	mapper := nsMapperForTest()
	gen := ngmodels.RuleGen
	recording := gen.With(gen.WithOrgID(1), gen.WithAllRecordingRules()).GenerateRef()
	alerting := gen.With(gen.WithOrgID(1)).GenerateRef()
	alerting.Record = nil

	versions := []*ngmodels.AlertRuleVersion{
		{AlertRule: *recording, Message: "v1"},
		{AlertRule: *alerting, Message: "should be skipped"},
	}

	out, err := convertVersionsToK8sResources(1, versions, mapper)
	require.NoError(t, err)
	require.Len(t, out.Items, 1)
	assert.Equal(t, recording.UID, out.Items[0].Name)
}

func TestConvertDeletedToK8sResources(t *testing.T) {
	mapper := nsMapperForTest()
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithOrgID(1), gen.WithAllRecordingRules()).GenerateRef()
	rule.UID = ""
	rule.Updated = time.Now()

	out, err := convertDeletedToK8sResources(1, []*ngmodels.AlertRule{rule}, mapper)
	require.NoError(t, err)
	require.Len(t, out.Items, 1)
	got := out.Items[0]

	assert.Equal(t, rule.GUID, got.Name)
	require.NotNil(t, got.DeletionTimestamp, "deleted rule should carry a deletion timestamp")
}

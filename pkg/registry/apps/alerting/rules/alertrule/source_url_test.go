package alertrule

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestSourceURLRoundTrip(t *testing.T) {
	mapper := nsMapperForTest()
	sourceURL := "https://example.com/alerts/rule.yaml"
	rule := alertingRuleForSourceURLTest()
	rule.SourceURL = &sourceURL

	k8sRule, err := convertToK8sResource(rule.OrgID, rule, ngmodels.ProvenanceToManagerProperties(ngmodels.ProvenanceAPI), mapper)
	require.NoError(t, err)
	require.Equal(t, sourceURL, k8sRule.Annotations[utils.AnnoKeySourcePath])

	domain, _, err := convertToDomainModel(rule.OrgID, k8sRule)
	require.NoError(t, err)
	require.NotNil(t, domain.SourceURL)
	require.Equal(t, sourceURL, *domain.SourceURL)

	empty := ""
	domain.SourceURL = &empty
	cleared, err := convertToK8sResource(rule.OrgID, domain, ngmodels.ProvenanceToManagerProperties(ngmodels.ProvenanceAPI), mapper)
	require.NoError(t, err)
	require.NotContains(t, cleared.Annotations, utils.AnnoKeySourcePath)

	// A nil pointer is not a write, so the conversion does not emit a source annotation.
	domain.SourceURL = nil
	unchanged, err := convertToK8sResource(rule.OrgID, domain, ngmodels.ProvenanceToManagerProperties(ngmodels.ProvenanceAPI), mapper)
	require.NoError(t, err)
	require.NotContains(t, unchanged.Annotations, utils.AnnoKeySourcePath)
}

func TestSourcePathWithoutURLDoesNotWrite(t *testing.T) {
	mapper := nsMapperForTest()
	rule := alertingRuleForSourceURLTest()
	k8sRule, err := convertToK8sResource(rule.OrgID, rule, ngmodels.ProvenanceToManagerProperties(ngmodels.ProvenanceAPI), mapper)
	require.NoError(t, err)

	domain, _, err := convertToDomainModel(rule.OrgID, k8sRule)
	require.NoError(t, err)
	require.Nil(t, domain.SourceURL)

	if k8sRule.Annotations == nil {
		k8sRule.Annotations = map[string]string{}
	}
	k8sRule.Annotations[utils.AnnoKeySourcePath] = "alerts/rule.json"
	domain, _, err = convertToDomainModel(rule.OrgID, k8sRule)
	require.NoError(t, err)
	require.Nil(t, domain.SourceURL)
}

func TestSourceURLRejectedWhenProvenanceNone(t *testing.T) {
	mapper := nsMapperForTest()
	rule := alertingRuleForSourceURLTest()
	k8sRule, err := convertToK8sResource(rule.OrgID, rule, ngmodels.ProvenanceToManagerProperties(ngmodels.ProvenanceNone), mapper)
	require.NoError(t, err)
	if k8sRule.Annotations == nil {
		k8sRule.Annotations = map[string]string{}
	}
	k8sRule.Annotations[utils.AnnoKeySourcePath] = "https://example.com/alerts/rule.yaml"

	_, _, err = convertToDomainModel(rule.OrgID, k8sRule)
	require.ErrorIs(t, err, ngmodels.ErrAlertRuleFailedValidation)
}

func TestToAPIErrorMapsInvalidSourceURLToBadRequest(t *testing.T) {
	err := toAPIError("rule", fmt.Errorf("%w: sourceUrl requires a provisioned rule", ngmodels.ErrAlertRuleFailedValidation))
	require.True(t, k8serrors.IsBadRequest(err))

	other := fmt.Errorf("boom")
	require.ErrorIs(t, toAPIError("rule", other), other)
	require.False(t, k8serrors.IsBadRequest(toAPIError("rule", other)))
}

func alertingRuleForSourceURLTest() *ngmodels.AlertRule {
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithOrgID(1)).GenerateRef()
	rule.Record = nil
	if len(rule.Data) > 0 {
		rule.Condition = rule.Data[0].RefID
	}
	return rule
}

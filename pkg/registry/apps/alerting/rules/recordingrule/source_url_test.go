package recordingrule

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestSourceURLRoundTrip(t *testing.T) {
	mapper := nsMapperForTest()
	sourceURL := "https://example.com/alerts/recording.yaml"
	rule := recordingRuleForSourceURLTest()
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
}

func TestSourcePathWithoutURLDoesNotWrite(t *testing.T) {
	mapper := nsMapperForTest()
	rule := recordingRuleForSourceURLTest()
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
	rule := recordingRuleForSourceURLTest()
	k8sRule, err := convertToK8sResource(rule.OrgID, rule, ngmodels.ProvenanceToManagerProperties(ngmodels.ProvenanceNone), mapper)
	require.NoError(t, err)
	if k8sRule.Annotations == nil {
		k8sRule.Annotations = map[string]string{}
	}
	k8sRule.Annotations[utils.AnnoKeySourcePath] = "https://example.com/alerts/recording.yaml"

	_, _, err = convertToDomainModel(rule.OrgID, k8sRule)
	require.ErrorIs(t, err, ngmodels.ErrAlertRuleFailedValidation)
}

func TestBadRequestIfInvalidRuleMapsSourceURL(t *testing.T) {
	err := badRequestIfInvalidRule(fmt.Errorf("%w: sourceUrl requires a provisioned rule", ngmodels.ErrAlertRuleFailedValidation))
	require.True(t, k8serrors.IsBadRequest(err))

	other := errors.New("boom")
	require.ErrorIs(t, badRequestIfInvalidRule(other), other)
	require.False(t, k8serrors.IsBadRequest(badRequestIfInvalidRule(other)))
}

func recordingRuleForSourceURLTest() *ngmodels.AlertRule {
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithOrgID(1), gen.WithAllRecordingRules()).GenerateRef()
	rule.Record.From = rule.Data[0].RefID
	return rule
}

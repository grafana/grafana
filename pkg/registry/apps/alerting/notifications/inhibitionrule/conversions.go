package inhibitionrule

import (
	"fmt"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func ConvertToK8sResources(orgID int64, rules []definitions.InhibitionRule, namespacer request.NamespaceMapper, selector fields.Selector) *model.InhibitionRuleList {
	result := &model.InhibitionRuleList{}

	for _, rule := range rules {
		item := ConvertToK8sResource(orgID, rule, namespacer)
		if selector != nil && !selector.Empty() && !selector.Matches(model.InhibitionRuleSelectableFields(item)) {
			continue
		}
		result.Items = append(result.Items, *item)
	}

	return result
}

func ConvertToK8sResource(orgID int64, rule definitions.InhibitionRule, namespacer request.NamespaceMapper) *model.InhibitionRule {
	i := model.InhibitionRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:            rule.Name,
			Namespace:       namespacer(orgID),
			ResourceVersion: rule.Fingerprint(),
		},
		Spec: convertDomainToK8sSpec(rule),
	}
	i.UID = gapiutil.CalculateClusterWideUID(&i)

	i.SetProvenanceStatus(string(rule.Provenance))

	return &i
}

func convertDomainToK8sSpec(rule definitions.InhibitionRule) model.InhibitionRuleSpec {
	return model.InhibitionRuleSpec{
		SourceMatchers: convertLabelsMatchersToK8s(rule.SourceMatchers),
		TargetMatchers: convertLabelsMatchersToK8s(rule.TargetMatchers),
		Equal:          rule.Equal,
	}
}

func convertLabelsMatchersToK8s(matchers config.Matchers) []model.InhibitionRuleMatcher {
	if len(matchers) == 0 {
		return nil
	}

	result := make([]model.InhibitionRuleMatcher, 0, len(matchers))
	for _, m := range matchers {
		result = append(result, model.InhibitionRuleMatcher{
			Type:  model.InhibitionRuleMatcherType(m.Type.String()),
			Label: m.Name,
			Value: m.Value,
		})
	}
	return result
}

func convertToDomainModel(rule *model.InhibitionRule) (definitions.InhibitionRule, error) {
	result := definitions.InhibitionRule{
		Name:       rule.Name,
		Provenance: definitions.Provenance(ngmodels.ProvenanceNone),
	}

	// Convert source matchers from K8s format to prometheus format
	sourceMatchers, err := convertK8sMatchersToLabels(rule.Spec.SourceMatchers)
	if err != nil {
		return definitions.InhibitionRule{}, fmt.Errorf("invalid source matchers: %w", err)
	}
	result.SourceMatchers = config.Matchers(sourceMatchers)

	// Convert target matchers from K8s format to prometheus format
	targetMatchers, err := convertK8sMatchersToLabels(rule.Spec.TargetMatchers)
	if err != nil {
		return definitions.InhibitionRule{}, fmt.Errorf("invalid target matchers: %w", err)
	}
	result.TargetMatchers = config.Matchers(targetMatchers)

	// Copy equal labels
	result.Equal = rule.Spec.Equal

	return result, nil
}

func convertK8sMatchersToLabels(k8sMatchers []model.InhibitionRuleMatcher) (labels.Matchers, error) {
	if len(k8sMatchers) == 0 {
		return nil, nil
	}

	result := make(labels.Matchers, 0, len(k8sMatchers))
	for _, m := range k8sMatchers {
		matchType, err := convertMatcherType(string(m.Type))
		if err != nil {
			return nil, err
		}
		matcher, err := labels.NewMatcher(matchType, m.Label, m.Value)
		if err != nil {
			return nil, fmt.Errorf("invalid matcher (label=%s, type=%s, value=%s): %w", m.Label, m.Type, m.Value, err)
		}
		result = append(result, matcher)
	}
	return result, nil
}

func convertMatcherType(k8sType string) (labels.MatchType, error) {
	switch k8sType {
	case "=":
		return labels.MatchEqual, nil
	case "!=":
		return labels.MatchNotEqual, nil
	case "=~":
		return labels.MatchRegexp, nil
	case "!~":
		return labels.MatchNotRegexp, nil
	default:
		return labels.MatchEqual, ngmodels.MakeErrInhibitionRuleInvalid(fmt.Errorf("unknown matcher type: %s", k8sType))
	}
}

package inhibitionrule

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func ConvertToK8sResources(orgID int64, rules []v1.InhibitionRule, namespacer request.NamespaceMapper, selector fields.Selector) *model.InhibitionRuleList {
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

func ConvertToK8sResource(orgID int64, rule v1.InhibitionRule, namespacer request.NamespaceMapper) *model.InhibitionRule {
	i := model.InhibitionRule{
		TypeMeta: metav1.TypeMeta{
			APIVersion: kind.GroupVersionKind().GroupVersion().String(),
			Kind:       kind.Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:            string(rule.UID),
			Namespace:       namespacer(orgID),
			ResourceVersion: rule.Version,
		},
		Spec: convertDomainToK8sSpec(rule),
	}
	i.UID = gapiutil.CalculateClusterWideUID(&i)

	i.SetProvenanceStatus(string(rule.Provenance))

	return &i
}

func convertDomainToK8sSpec(rule v1.InhibitionRule) model.InhibitionRuleSpec {
	return model.InhibitionRuleSpec{
		SourceMatchers: convertLabelsMatchersToK8s(rule.SourceMatchers),
		TargetMatchers: convertLabelsMatchersToK8s(rule.TargetMatchers),
		Equal:          rule.Equal,
	}
}

func convertLabelsMatchersToK8s(matchers []v1.Matcher) []model.InhibitionRuleMatcher {
	if len(matchers) == 0 {
		return nil
	}

	result := make([]model.InhibitionRuleMatcher, 0, len(matchers))
	for _, m := range matchers {
		result = append(result, model.InhibitionRuleMatcher{
			Type:  model.InhibitionRuleMatcherType(m.Type),
			Label: m.Label,
			Value: m.Value,
		})
	}
	return result
}

func convertToDomainModel(rule *model.InhibitionRule) (v1.InhibitionRule, error) {
	prov, err := ngmodels.ProvenanceFromString(rule.GetProvenanceStatus())
	if err != nil {
		return v1.InhibitionRule{}, ngmodels.MakeErrInhibitionRuleInvalid(err)
	}
	return v1.InhibitionRule{
		ResourceMetadata: v1.ResourceMetadata{
			UID:        v1.ResourceUID(rule.Name),
			Provenance: prov,
		},
		SourceMatchers: convertK8sMatchersToLabels(rule.Spec.SourceMatchers),
		TargetMatchers: convertK8sMatchersToLabels(rule.Spec.TargetMatchers),
		Equal:          rule.Spec.Equal,
	}, nil
}

func convertK8sMatchersToLabels(k8sMatchers []model.InhibitionRuleMatcher) []v1.Matcher {
	if len(k8sMatchers) == 0 {
		return nil
	}

	result := make([]v1.Matcher, 0, len(k8sMatchers))
	for _, m := range k8sMatchers {
		result = append(result, v1.NewMatcher(v1.MatcherType(m.Type), m.Label, m.Value))
	}
	return result
}

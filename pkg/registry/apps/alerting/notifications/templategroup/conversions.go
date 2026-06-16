package templategroup

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func convertToK8sResources(orgID int64, list []v1.TemplateGroup, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TemplateGroupList, error) {
	result := &model.TemplateGroupList{}
	for _, t := range list {
		item := convertToK8sResource(orgID, t, namespacer)
		if selector != nil && !selector.Empty() && !selector.Matches(model.TemplateGroupSelectableFields(item)) {
			continue
		}
		result.Items = append(result.Items, *item)
	}
	return result, nil
}

func convertToK8sResource(orgID int64, template v1.TemplateGroup, namespacer request.NamespaceMapper) *model.TemplateGroup {
	result := &model.TemplateGroup{
		TypeMeta: metav1.TypeMeta{
			APIVersion: kind.GroupVersionKind().GroupVersion().String(),
			Kind:       kind.Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(template.UID),
			Name:            string(template.UID),
			Namespace:       namespacer(orgID),
			ResourceVersion: template.Version,
		},
		Spec: model.TemplateGroupSpec{
			Title:   template.Title,
			Content: template.Content,
			Kind:    model.TemplateGroupTemplateKind(template.Kind),
		},
	}
	result.SetProvenanceStatus(string(template.Provenance))
	result.UID = gapiutil.CalculateClusterWideUID(result)
	return result
}

func convertToDomainModel(template *model.TemplateGroup) (v1.TemplateGroup, error) {
	prov, err := ngmodels.ProvenanceFromString(template.GetProvenanceStatus())
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	return v1.TemplateGroup{
		ResourceMetadata: v1.ResourceMetadata{
			UID:        v1.ResourceUID(template.Name),
			Version:    template.ResourceVersion,
			Provenance: prov,
		},
		Title:   template.Spec.Title,
		Content: template.Spec.Content,
		Kind:    v1.TemplateKind(template.Spec.Kind),
	}, nil
}

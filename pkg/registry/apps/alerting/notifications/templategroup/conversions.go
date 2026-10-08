package templategroup

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/alerting/templates"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/provenance"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

const systemProvenance = "system"

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
	provenance.SetAnnotations(result, template.Manager)
	if string(template.UID) == templates.DefaultTemplateName {
		// The built-in default template has no manager, but it is not editable either.
		result.SetProvenanceStatus(systemProvenance)
	}
	result.UID = gapiutil.CalculateClusterWideUID(result)
	return result
}

func convertToDomainModel(template *model.TemplateGroup) (v1.TemplateGroup, error) {
	manager, err := provenance.FromAnnotations(template)
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	return v1.TemplateGroup{
		ResourceMetadata: v1.ResourceMetadata{
			UID:     v1.ResourceUID(template.Name),
			Version: template.ResourceVersion,
			Manager: manager,
		},
		Title:   template.Spec.Title,
		Content: template.Spec.Content,
		Kind:    v1.TemplateKind(template.Spec.Kind),
	}, nil
}

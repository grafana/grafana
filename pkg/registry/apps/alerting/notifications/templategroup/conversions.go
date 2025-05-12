package templategroup

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func convertToK8sResources(orgID int64, list []definitions.NotificationTemplate, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TemplateGroupList, error) {
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

func convertToK8sResource(orgID int64, template definitions.NotificationTemplate, namespacer request.NamespaceMapper) *model.TemplateGroup {
	result := &model.TemplateGroup{
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(template.UID),
			Name:            template.UID,
			Namespace:       namespacer(orgID),
			ResourceVersion: template.ResourceVersion,
		},
		Spec: model.TemplateGroupSpec{
			Title:   template.Name,
			Content: template.Template,
		},
	}
	result.SetProvenanceStatus(string(template.Provenance))
	result.UID = gapiutil.CalculateClusterWideUID(result)
	return result
}

func convertToDomainModel(template *model.TemplateGroup) definitions.NotificationTemplate {
	return definitions.NotificationTemplate{
		UID:             template.Name,
		Name:            template.Spec.Title,
		Template:        template.Spec.Content,
		ResourceVersion: template.ResourceVersion,
		Provenance:      definitions.Provenance(ngmodels.ProvenanceNone),
	}
}

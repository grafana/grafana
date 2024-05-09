package template

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	notifications "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func convertToK8sResources(orgID int64, list []definitions.NotificationTemplate, namespacer request.NamespaceMapper) (*notifications.TemplateGroupList, error) {
	result := &notifications.TemplateGroupList{}
	for _, t := range list {
		result.Items = append(result.Items, *convertToK8sResource(orgID, t, namespacer))
	}
	return result, nil
}

func convertToK8sResource(orgID int64, template definitions.NotificationTemplate, namespacer request.NamespaceMapper) *notifications.TemplateGroup {
	return &notifications.TemplateGroup{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:      template.Name,
			Namespace: namespacer(orgID),
			Annotations: map[string]string{ // TODO find a better place for provenance?
				"grafana.com/provenance": string(template.Provenance),
			},
			// TODO ResourceVersion and CreationTimestamp
		},
		Spec: notifications.TemplateGroupSpec{Content: template.Template},
	}
}

func convertToDomainModel(template *notifications.TemplateGroup) definitions.NotificationTemplate {
	return definitions.NotificationTemplate{
		Name:       template.Name,
		Template:   template.Spec.Content,
		Provenance: "",
	}
}

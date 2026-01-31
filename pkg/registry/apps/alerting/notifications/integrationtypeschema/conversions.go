package integrationtypeschema

import (
	"encoding/json"

	"github.com/grafana/alerting/receivers/schema"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

func ConvertToK8sResources(orgID int64, schemas []schema.IntegrationTypeSchema, namespacer request.NamespaceMapper, selector fields.Selector) (*model.IntegrationTypeSchemaList, error) {
	result := &model.IntegrationTypeSchemaList{}

	for _, s := range schemas {
		data, err := json.Marshal(s)
		if err != nil {
			return nil, err
		}
		var spec model.IntegrationTypeSchemaSpec
		if err := json.Unmarshal(data, &spec); err != nil {
			return nil, err
		}

		item := buildIntegrationTypeSchema(orgID, s, spec, namespacer)
		// Skip field selector for now - add IntegrationTypeSchemaSelectableFields if needed
		result.Items = append(result.Items, item)
	}
	return result, nil
}

func ConvertToK8sResource(orgID int64, s schema.IntegrationTypeSchema, namespacer request.NamespaceMapper) (*model.IntegrationTypeSchema, error) {
	data, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	spec := model.IntegrationTypeSchemaSpec{}
	if err := json.Unmarshal(data, &spec); err != nil {
		return nil, err
	}
	result := buildIntegrationTypeSchema(orgID, s, spec, namespacer)
	return &result, nil
}

func buildIntegrationTypeSchema(orgID int64, s schema.IntegrationTypeSchema, spec model.IntegrationTypeSchemaSpec, namespacer request.NamespaceMapper) model.IntegrationTypeSchema {
	r := model.IntegrationTypeSchema{
		ObjectMeta: metav1.ObjectMeta{
			UID:       types.UID(s.Type),
			Name:      string(s.Type),
			Namespace: namespacer(orgID),
		},
		Spec: spec,
	}
	r.UID = gapiutil.CalculateClusterWideUID(&r)
	return r
}

package schema

import (
	"fmt"

	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource/schemabuilder"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

func GetQuerySchema(defs *query.QueryTypeDefinitionList) (*spec.Schema, error) {
	if defs == nil {
		return nil, fmt.Errorf("missing QueryTypeDefinitionList")
	}

	// Convert the real k8s resource to the fake one used in the sdk
	qtds := resource.QueryTypeDefinitionList{}
	for _, def := range defs.Items {
		qtds.Items = append(qtds.Items, resource.QueryTypeDefinition{
			ObjectMeta: resource.ObjectMeta{
				Name: def.Name,
			},
			Spec: def.Spec,
		})
	}

	return schemabuilder.GetQuerySchema(schemabuilder.QuerySchemaOptions{
		PluginID:   []string{"xxxxx"},
		QueryTypes: qtds.Items,
		Mode:       schemabuilder.SchemaTypeQueryRequest,
	})
}

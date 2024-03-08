package schema

import (
	"fmt"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"
	"k8s.io/kube-openapi/pkg/validation/spec"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

func GetQuerySchema(defs *query.QueryTypeDefinitionList) (*spec.Schema, error) {
	if defs == nil {
		return nil, fmt.Errorf("missing QueryTypeDefinitionList")
	}

	// Convert the real k8s resource to the fake one used in the sdk
	qtds := data.QueryTypeDefinitionList{}
	for _, def := range defs.Items {
		qtds.Items = append(qtds.Items, data.QueryTypeDefinition{
			ObjectMeta: data.ObjectMeta{
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

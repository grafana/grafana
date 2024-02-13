package schema

import (
	"encoding/json"
	"fmt"

	"k8s.io/kube-openapi/pkg/validation/spec"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

func GetQuerySchema(defs *query.QueryTypeDefinitionList) (*spec.Schema, error) {
	if defs == nil {
		return nil, fmt.Errorf("missing QueryTypeDefinitionList")
	}

	generic := query.GenericDataQuery{}.OpenAPIDefinition().Schema
	delete(generic.VendorExtensible.Extensions, "x-kubernetes-preserve-unknown-fields")
	generic.ID = ""
	generic.Schema = ""

	s := &spec.Schema{
		SchemaProps: spec.SchemaProps{
			Type:        []string{"object"},
			Properties:  make(map[string]spec.Schema),
			Definitions: make(spec.Definitions),
		},
	}

	queryTypeEnum := spec.StringProperty().WithDescription("Query type selector")

	common := make(map[string]spec.Schema)
	for k, v := range generic.Properties {
		if k == "queryType" {
			continue
		}

		s.Definitions[k] = v
		common[k] = *spec.RefProperty("#/definitions/" + k)
	}

	// //	refId := s.Properties["refId"]
	// ds := generic.Properties["datasource"]
	// t := ds.Properties["uid"]
	// t.AddExtension("const", "expr") // must be the constant value

	// s := generic
	// delete(s.Properties, "queryType") // gets replaced

	// generic.Properties["resultAssertions"] = *spec.RefProperty("#/definitions/resultAssertions")
	// generic.Properties["timeRange"] = *spec.RefProperty("#/definitions/timeRange")

	for _, qt := range defs.Items {
		discriminator := qt.Spec.DiscriminatorField
		if discriminator == "" {
			discriminator = "queryType"
		}
		s.WithDiscriminator(discriminator)

		for _, ver := range qt.Spec.Versions {
			key := qt.Name
			if ver.Version != "" {
				key = fmt.Sprintf("%s/%s", qt.Name, ver.Version)
			}
			queryTypeEnum.Enum = append(queryTypeEnum.Enum, key)

			node := spec.Schema{}
			err := json.Unmarshal(ver.Schema, &node)
			if err != nil {
				return nil, fmt.Errorf("error reading query types schema: %s // %w", key, err)
			}
			t := spec.StringProperty().WithDescription(key)
			t.WithPattern(`^` + key + `$`) // no const value
			if node.Properties == nil {
				node.Properties = make(map[string]spec.Schema)
			}
			node.Properties[discriminator] = *t
			node.Required = append(node.Required, discriminator, "refId")

			for k, v := range common {
				_, found := node.Properties[k]
				if found {
					continue
				}
				node.Properties[k] = v
			}

			s.OneOf = append(s.OneOf, node)
		}
	}

	s.Properties["queryType"] = *queryTypeEnum
	return s, nil
}

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
	generic.AdditionalProperties = nil
	delete(generic.VendorExtensible.Extensions, "x-kubernetes-preserve-unknown-fields")
	generic.ID = ""
	generic.Schema = ""
	discriminator := ""
	type querySpec struct {
		key    string
		schema *spec.Schema
	}

	specs := []querySpec{}
	for _, qt := range defs.Items {
		if qt.Spec.DiscriminatorField != "" {
			if discriminator == "" {
				discriminator = qt.Spec.DiscriminatorField
			} else if discriminator != qt.Spec.DiscriminatorField {
				return nil, fmt.Errorf("discriminator fields must be the same")
			}
		}

		for _, ver := range qt.Spec.Versions {
			key := qt.Name
			if ver.Version != "" {
				key = fmt.Sprintf("%s/%s", qt.Name, ver.Version)
			}

			node := &spec.Schema{}
			err := json.Unmarshal(ver.Schema, node)
			if err != nil {
				return nil, fmt.Errorf("error reading query types schema: %s // %w", key, err)
			}

			specs = append(specs, querySpec{
				key:    key,
				schema: node,
			})
		}
	}

	// Single node -- just union the global and local properties
	if len(specs) == 1 {
		node := specs[0].schema
		for k, v := range generic.Properties {
			_, found := node.Properties[k]
			if found {
				continue
			}
			node.Properties[k] = v
		}
		return node, nil
	}

	if discriminator == "" {
		return nil, fmt.Errorf("missing discriminator field with multiple schemas")
	}

	queryTypeEnum := spec.StringProperty().WithDescription("Query type selector")
	s := &spec.Schema{
		SchemaProps: spec.SchemaProps{
			Type:        []string{"object"},
			Properties:  make(map[string]spec.Schema),
			Definitions: make(spec.Definitions),
		},
	}
	s.WithDiscriminator(discriminator)

	common := make(map[string]spec.Schema)
	for k, v := range generic.Properties {
		if k == discriminator {
			continue
		}
		s.Definitions[k] = v
		common[k] = *spec.RefProperty("#/definitions/" + k)
	}

	for _, qt := range specs {
		key := qt.key
		node := qt.schema

		queryTypeEnum.Enum = append(queryTypeEnum.Enum, key)

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

		s.OneOf = append(s.OneOf, *node)
	}

	s.Properties[discriminator] = *queryTypeEnum
	return s, nil
}

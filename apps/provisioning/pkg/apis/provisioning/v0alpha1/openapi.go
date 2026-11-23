package v0alpha1

import (
	"slices"

	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/resource"
)

// GetOpenAPIDefinitionsWithSecureValues returns GetOpenAPIDefinitions with
// the secure property of each kind pointing at its schema-only struct.
// openapi-gen would otherwise publish the secure map as an object with
// arbitrary keys, dropping the accepted key names from the API.
func GetOpenAPIDefinitionsWithSecureValues(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	defs := GetOpenAPIDefinitions(ref)
	setSecureSchema(defs, ref, Repository{}.OpenAPIModelName(), SecureValues{}.OpenAPIModelName())
	setSecureSchema(defs, ref, Connection{}.OpenAPIModelName(), ConnectionSecure{}.OpenAPIModelName())
	return defs
}

func setSecureSchema(defs map[string]common.OpenAPIDefinition, ref common.ReferenceCallback, kindModel, secureModel string) {
	def := defs[kindModel]
	def.Schema.Properties["secure"] = spec.Schema{
		SchemaProps: spec.SchemaProps{
			Default: map[string]interface{}{},
			Ref:     ref(secureModel),
		},
	}

	inlineSecureValue := resource.InlineSecureValue{}.OpenAPIModelName()
	def.Dependencies = slices.DeleteFunc(def.Dependencies, func(dep string) bool { return dep == inlineSecureValue })
	def.Dependencies = append(def.Dependencies, secureModel)
	slices.Sort(def.Dependencies)
	defs[kindModel] = def
}

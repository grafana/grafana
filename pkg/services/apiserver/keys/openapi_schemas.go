package keys

import (
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/util"
	"k8s.io/kube-openapi/pkg/validation/spec"

	storagev0 "github.com/grafana/grafana/pkg/apis/storage/v0alpha1"
)

const componentPrefix = "#/components/schemas/"

// Go names, because that is how the generated definitions are keyed.
const (
	listKeyRequestGoName  = "github.com/grafana/grafana/pkg/apis/storage/v0alpha1." + storagev0.KindListKeyRequest
	listKeyResponseGoName = "github.com/grafana/grafana/pkg/apis/storage/v0alpha1." + storagev0.KindListKeyResponse
)

// Each group version's spec is self-contained, so the components have to travel
// with the route. Dependencies are followed rather than listed because a missing
// one renders as an empty model with no error.
func envelopeSchemas(roots ...string) map[string]spec.Schema {
	defs := storagev0.GetOpenAPIDefinitions(schemaRef)

	out := map[string]spec.Schema{}
	queue := append([]string{}, roots...)
	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]

		if _, seen := out[friendly(name)]; seen {
			continue
		}
		def, ok := defs[name]
		if !ok {
			continue
		}
		out[friendly(name)] = def.Schema
		queue = append(queue, def.Dependencies...)
	}

	return out
}

// Generated dependencies come as either Go import paths or names already
// converted by OpenAPIModelName; converting an already-converted name reverses it.
func friendly(name string) string {
	if strings.Contains(name, "/") {
		return util.ToRESTFriendlyName(name)
	}
	return name
}

func schemaRef(goName string) spec.Ref {
	return spec.MustCreateRef(componentPrefix + friendly(goName))
}

func jsonContent(goName string, example any) map[string]*spec3.MediaType {
	return map[string]*spec3.MediaType{
		"application/json": {
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{
					SchemaProps: spec.SchemaProps{Ref: schemaRef(goName)},
				},
				Example: example,
			},
		},
	}
}

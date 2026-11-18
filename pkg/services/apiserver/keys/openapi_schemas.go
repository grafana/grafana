package keys

import (
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	storagev0 "github.com/grafana/grafana/pkg/apis/storage/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// Go names, because that is how the generated definitions are keyed.
const (
	listKeyRequestGoName  = "github.com/grafana/grafana/pkg/apis/storage/v0alpha1." + storagev0.KindListKeyRequest
	listKeyResponseGoName = "github.com/grafana/grafana/pkg/apis/storage/v0alpha1." + storagev0.KindListKeyResponse
)

// Each group version's spec is self-contained, so the components have to travel
// with the route.
func envelopeSchemas(roots ...string) map[string]spec.Schema {
	return builder.RouteSchemas(storagev0.GetOpenAPIDefinitions, roots...)
}

func jsonContent(goName string, example any) map[string]*spec3.MediaType {
	return map[string]*spec3.MediaType{
		"application/json": {
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{
					SchemaProps: spec.SchemaProps{Ref: builder.RouteSchemaRef(goName)},
				},
				Example: example,
			},
		},
	}
}

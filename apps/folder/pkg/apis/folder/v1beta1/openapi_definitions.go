package v1beta1

import (
	"strings"

	folderapiv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	common "k8s.io/kube-openapi/pkg/common"
)

const (
	goImportV1      = "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	goImportV1beta1 = "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
)

// GetOpenAPIDefinitions returns the same schemas as v1 with kube-openapi model keys rewritten for v1beta1.
func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	in := folderapiv1.GetOpenAPIDefinitions(ref)
	out := make(map[string]common.OpenAPIDefinition, len(in))
	v1Models := strings.TrimSuffix(folderapiv1.OpenAPIPrefix, ".")
	v1beta1Models := strings.TrimSuffix(OpenAPIPrefix, ".")
	for k, def := range in {
		k = strings.ReplaceAll(k, v1Models, v1beta1Models)
		k = strings.ReplaceAll(k, goImportV1, goImportV1beta1)
		out[k] = def
	}
	return out
}

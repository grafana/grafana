package builders

import (
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func GetExternalGroupMappingBuilder(registry *resource.SearchFieldsRegistry) (resource.DocumentBuilderInfo, error) {
	return iamBuilder(registry, iamv0.ExternalGroupMappingResourceInfo)
}

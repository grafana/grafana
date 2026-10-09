package builders

import (
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func GetExternalGroupMappingBuilder(registry *searchmodel.SearchFieldsRegistry) (searchmodel.DocumentBuilderInfo, error) {
	return iamBuilder(registry, iamv0.ExternalGroupMappingResourceInfo)
}

package builders

import (
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// externalGroupMappingSearchFields are read from the generated IAM manifest,
// where they are declared in apps/iam/kinds/externalgroupmapping.cue.
var externalGroupMappingSearchFields = resource.NewManifestBackedProvider(iamManifests).Fields(
	iamv0.ExternalGroupMappingResourceInfo.GroupVersionResource(),
)

func GetExternalGroupMappingBuilder() (resource.DocumentBuilderInfo, error) {
	return iamBuilder(iamv0.ExternalGroupMappingResourceInfo, externalGroupMappingSearchFields)
}

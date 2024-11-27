package common

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"

	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type TypeInfo struct {
	Type      string
	Relations []string
}

var typedResources = map[string]TypeInfo{
	FormatGroupResource(
		folderalpha1.FolderResourceInfo.GroupResource().Group,
		folderalpha1.FolderResourceInfo.GroupResource().Resource,
	): {Type: "folder", Relations: append(ResourceRelations, RelationCreate)},
}

func GetTypeInfo(group, resource string) (TypeInfo, bool) {
	info, ok := typedResources[FormatGroupResource(group, resource)]
	return info, ok
}

var VerbMapping = map[string]string{
	utils.VerbGet:              RelationRead,
	utils.VerbList:             RelationRead,
	utils.VerbWatch:            RelationRead,
	utils.VerbCreate:           RelationCreate,
	utils.VerbUpdate:           RelationWrite,
	utils.VerbPatch:            RelationWrite,
	utils.VerbDelete:           RelationDelete,
	utils.VerbDeleteCollection: RelationDelete,
}

var RelationToVerbMapping = map[string]string{
	RelationRead:   utils.VerbGet,
	RelationCreate: utils.VerbCreate,
	RelationWrite:  utils.VerbUpdate,
	RelationDelete: utils.VerbDelete,
}

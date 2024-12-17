package common

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"

	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type typeInfo struct {
	Type      string
	Relations []string
}

var typedResources = map[string]typeInfo{
	FormatGroupResource(
		folderalpha1.FolderResourceInfo.GroupResource().Group,
		folderalpha1.FolderResourceInfo.GroupResource().Resource,
	): {Type: "folder", Relations: RelationsFolder},
}

func getTypeInfo(group, resource string) (typeInfo, bool) {
	info, ok := typedResources[FormatGroupResource(group, resource)]
	return info, ok
}

var VerbMapping = map[string]string{
	utils.VerbGet:              RelationGet,
	utils.VerbList:             RelationGet,
	utils.VerbWatch:            RelationGet,
	utils.VerbCreate:           RelationCreate,
	utils.VerbUpdate:           RelationUpdate,
	utils.VerbPatch:            RelationUpdate,
	utils.VerbDelete:           RelationDelete,
	utils.VerbDeleteCollection: RelationDelete,
}

var RelationToVerbMapping = map[string]string{
	RelationGet:    utils.VerbGet,
	RelationCreate: utils.VerbCreate,
	RelationUpdate: utils.VerbUpdate,
	RelationDelete: utils.VerbDelete,
}

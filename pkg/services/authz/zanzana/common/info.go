package common

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"

	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type TypeInfo struct {
	Type      string
	Relations []string
}

func (t TypeInfo) IsValidRelation(relation string) bool {
	return isValidRelation(relation, t.Relations)
}

var typedResources = map[string]TypeInfo{
	FormatGroupResource(
		folderalpha1.FolderResourceInfo.GroupResource().Group,
		folderalpha1.FolderResourceInfo.GroupResource().Resource,
	): {Type: "folder", Relations: RelationsFolder},
}

func GetTypeInfo(group, resource string) (TypeInfo, bool) {
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

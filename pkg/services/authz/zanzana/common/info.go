package common

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"

	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type TypeInfo struct {
	Type string
}

var typedResources = map[string]TypeInfo{
	NewNamespaceResourceIdent(
		folderalpha1.FolderResourceInfo.GroupResource().Group,
		folderalpha1.FolderResourceInfo.GroupResource().Resource,
	): TypeInfo{Type: "folder2"},
}

func GetTypeInfo(group, resource string) (TypeInfo, bool) {
	info, ok := typedResources[NewNamespaceResourceIdent(group, resource)]
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

package common

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"

	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type TypeInfo struct {
	Type string
}

var typedResources = map[string]TypeInfo{
	NewNamespaceResourceIdent(folderalpha1.GROUP, folderalpha1.RESOURCE): TypeInfo{Type: "folder2"},
}

func GetTypeInfo(group, resource string) (TypeInfo, bool) {
	info, ok := typedResources[NewNamespaceResourceIdent(group, resource)]
	return info, ok
}

var VerbMapping = map[string]string{
	utils.VerbGet:              "read",
	utils.VerbList:             "read",
	utils.VerbWatch:            "read",
	utils.VerbCreate:           "create",
	utils.VerbUpdate:           "write",
	utils.VerbPatch:            "write",
	utils.VerbDelete:           "delete",
	utils.VerbDeleteCollection: "delete",
}

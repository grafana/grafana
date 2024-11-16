package zanzana

import (
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/authlib/authz"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

const (
	TypeUser      = common.TypeUser
	TypeTeam      = common.TypeTeam
	TypeRole      = common.TypeRole
	TypeFolder    = common.TypeFolder
	TypeResource  = common.TypeResource
	TypeNamespace = common.TypeNamespace
)

const (
	RelationTeamMember = common.RelationTeamMember
	RelationTeamAdmin  = common.RelationTeamAdmin
	RelationParent     = common.RelationParent
	RelationAssignee   = common.RelationAssignee

	RelationSetView  = common.RelationSetView
	RelationSetEdit  = common.RelationSetEdit
	RelationSetAdmin = common.RelationSetAdmin

	RelationRead             = common.RelationRead
	RelationWrite            = common.RelationWrite
	RelationCreate           = common.RelationCreate
	RelationDelete           = common.RelationDelete
	RelationPermissionsRead  = common.RelationPermissionsRead
	RelationPermissionsWrite = common.RelationPermissionsWrite

	RelationFolderResourceSetView  = common.RelationFolderResourceSetView
	RelationFolderResourceSetEdit  = common.RelationFolderResourceSetEdit
	RelationFolderResourceSetAdmin = common.RelationFolderResourceSetAdmin

	RelationFolderResourceRead             = common.RelationFolderResourceRead
	RelationFolderResourceWrite            = common.RelationFolderResourceWrite
	RelationFolderResourceCreate           = common.RelationFolderResourceCreate
	RelationFolderResourceDelete           = common.RelationFolderResourceDelete
	RelationFolderResourcePermissionsRead  = common.RelationFolderResourcePermissionsRead
	RelationFolderResourcePermissionsWrite = common.RelationFolderResourcePermissionsWrite
)

var ResourceRelations = []string{
	RelationRead,
	RelationWrite,
	RelationCreate,
	RelationDelete,
	RelationPermissionsRead,
	RelationPermissionsWrite,
}

var FolderRelations = append(
	ResourceRelations,
	RelationFolderResourceRead,
	RelationFolderResourceWrite,
	RelationFolderResourceCreate,
	RelationFolderResourceDelete,
	RelationFolderResourcePermissionsRead,
	RelationFolderResourcePermissionsWrite,
)

const (
	KindDashboards string = "dashboards"
	KindFolders    string = "folders"
)

var (
	ToAuthzExtTupleKey                  = common.ToAuthzExtTupleKey
	ToAuthzExtTupleKeys                 = common.ToAuthzExtTupleKeys
	ToAuthzExtTupleKeyWithoutCondition  = common.ToAuthzExtTupleKeyWithoutCondition
	ToAuthzExtTupleKeysWithoutCondition = common.ToAuthzExtTupleKeysWithoutCondition

	ToOpenFGATuple                    = common.ToOpenFGATuple
	ToOpenFGATuples                   = common.ToOpenFGATuples
	ToOpenFGATupleKey                 = common.ToOpenFGATupleKey
	ToOpenFGATupleKeyWithoutCondition = common.ToOpenFGATupleKeyWithoutCondition
)

// NewTupleEntry constructs new openfga entry type:name[#relation].
// Relation allows to specify group of users (subjects) related to type:name
// (for example, team:devs#member refers to users which are members of team devs)
func NewTupleEntry(objectType, name, relation string) string {
	obj := fmt.Sprintf("%s:%s", objectType, name)
	if relation != "" {
		obj = fmt.Sprintf("%s#%s", obj, relation)
	}
	return obj
}

func TranslateToResourceTuple(subject string, action, kind, name string) (*openfgav1.TupleKey, bool) {
	translation, ok := resourceTranslations[kind]

	if !ok {
		return nil, false
	}

	m, ok := translation.mapping[action]
	if !ok {
		return nil, false
	}

	if name == "*" {
		return common.NewNamespaceResourceTuple(subject, m.relation, translation.group, translation.resource), true
	}

	if translation.typ == TypeResource {
		return common.NewResourceTuple(subject, m.relation, translation.group, translation.resource, name), true
	}

	if translation.typ == TypeFolder {
		if m.group != "" && m.resource != "" {
			return common.NewFolderResourceTuple(subject, m.relation, m.group, m.resource, name), true
		}

		return common.NewFolderTuple(subject, m.relation, name), true
	}

	return common.NewTypedTuple(translation.typ, subject, m.relation, name), true
}

func IsFolderResourceTuple(t *openfgav1.TupleKey) bool {
	return strings.HasPrefix(t.Object, TypeFolder) && strings.HasPrefix(t.Relation, "resource_")
}

func MergeFolderResourceTuples(a, b *openfgav1.TupleKey) {
	va := a.Condition.Context.Fields["group_resources"]
	vb := b.Condition.Context.Fields["group_resources"]
	va.GetListValue().Values = append(va.GetListValue().Values, vb.GetListValue().Values...)
}

func TranslateToCheckRequest(namespace, action, kind, folder, name string) (*authz.CheckRequest, bool) {
	translation, ok := resourceTranslations[kind]

	if !ok {
		return nil, false
	}

	m, ok := translation.mapping[action]
	if !ok {
		return nil, false
	}

	verb, ok := common.RelationToVerbMapping[m.relation]
	if !ok {
		return nil, false
	}

	req := &authz.CheckRequest{
		Namespace: namespace,
		Verb:      verb,
		Group:     translation.group,
		Resource:  translation.resource,
		Name:      name,
		Folder:    folder,
	}

	return req, true
}

func TranslateBasicRole(name string) string {
	return basicRolesTranslations[name]
}

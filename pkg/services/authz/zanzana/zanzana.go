package zanzana

import (
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

const (
	TypeUser     string = "user"
	TypeTeam     string = "team"
	TypeRole     string = "role"
	TypeFolder   string = "folder"
	TypeResource string = "resource"
)

const (
	RelationTeamMember string = "member"
	RelationTeamAdmin  string = "admin"
	RelationParent     string = "parent"
	RelationAssignee   string = "assignee"
	RelationOrg        string = "org"

	// FIXME action sets
	RelationAdmin            string = "admin"
	RelationRead             string = "read"
	RelationWrite            string = "write"
	RelationCreate           string = "create"
	RelationDelete           string = "delete"
	RelationPermissionsRead  string = "permissions_read"
	RelationPermissionsWrite string = "permissions_write"

	FolderResourceRelationAdmin            string = "resource_admin"
	FolderResourceRelationRead             string = "resource_read"
	FolderResourceRelationWrite            string = "resource_write"
	FolderResourceRelationCreate           string = "resource_create"
	FolderResourceRelationDelete           string = "resource_delete"
	FolderResourceRelationPermissionsRead  string = "resource_permissions_read"
	FolderResourceRelationPermissionsWrite string = "resource_permissions_write"
)

var ResourceRelations = []string{RelationRead, RelationWrite, RelationCreate, RelationDelete, RelationPermissionsRead, RelationPermissionsWrite}
var FolderRelations = append(ResourceRelations, FolderResourceRelationRead, FolderResourceRelationWrite, FolderResourceRelationCreate, FolderResourceRelationDelete, FolderResourceRelationPermissionsRead, FolderResourceRelationPermissionsWrite)

const (
	KindDashboards string = "dashboards"
	KindFolders    string = "folders"
)

const (
	RoleGrafanaAdmin = "Grafana Admin"
	RoleAdmin        = "Admin"
	RoleEditor       = "Editor"
	RoleViewer       = "Viewer"
	RoleNone         = "None"

	BasicRolePrefix    = "basic:"
	BasicRoleUIDPrefix = "basic_"

	GlobalOrgID = 0
)

// NewTupleEntry constructs new openfga entry type:id[#relation].
// Relation allows to specify group of users (subjects) related to type:id
// (for example, team:devs#member refers to users which are members of team devs)
func NewTupleEntry(objectType, id, relation string) string {
	obj := fmt.Sprintf("%s:%s", objectType, id)
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

func TranslateFixedRole(role string) string {
	role = strings.ReplaceAll(role, ":", "_")
	role = strings.ReplaceAll(role, ".", "_")
	return role
}

// Translate "read" for the dashboard into "dashboard_read" for folder
func TranslateToFolderRelation(relation, objectType string) string {
	return fmt.Sprintf("%s_%s", objectType, relation)
}

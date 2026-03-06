package zanzana

import (
	"errors"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"

	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var (
	errEmptyName        = errors.New("name cannot be empty")
	errInvalidBasicRole = errors.New("invalid basic role")
	errUnknownKind      = errors.New("unknown permission kind")
)

// TupleStringWithoutCondition returns the string representation of a tuple without its condition.
// This is useful for deduplicating tuples that have the same user, relation, and object
// but different conditions that need to be merged.
func TupleStringWithoutCondition(tuple *openfgav1.TupleKey) string {
	c := tuple.Condition
	tuple.Condition = nil
	s := tuple.String()
	tuple.Condition = c
	return s
}

// RolePermission represents a permission that can be converted to a Zanzana tuple.
type RolePermission struct {
	Action     string
	Kind       string
	Identifier string
}

// ConvertRolePermissionsToTuples converts role permissions to Zanzana tuples with proper merging.
// It handles:
// - Translation of RBAC action/kind/identifier to Zanzana tuples
// - Special handling for folder resource tuples (which need to be merged)
// - Deduplication of tuples
//
// Returns a slice of tuples ready to be written to Zanzana, or nil if no valid tuples could be created.
func ConvertRolePermissionsToTuples(roleUID string, permissions []RolePermission) ([]*openfgav1.TupleKey, error) {
	if len(permissions) == 0 {
		return nil, nil
	}

	// Subject for role permissions: role:{uid}#assignee
	subject := NewTupleEntry(TypeRole, roleUID, RelationAssignee)

	// Use a map to track tuples, with special handling for folder resource tuples
	tupleMap := make(map[string]*openfgav1.TupleKey)
	folderResourceTuples := make(map[string]*openfgav1.TupleKey) // key is tuple without condition

	for _, perm := range permissions {
		// Convert RBAC action/kind to Zanzana tuple
		tuple, ok := TranslateToResourceTuple(subject, perm.Action, perm.Kind, perm.Identifier)
		if !ok {
			// Skip permissions that can't be translated
			log.New("zanzana").Debug("skipping permission that can't be translated", "permission", perm)
			continue
		}

		// Handle folder resource tuples specially - they need to be merged
		if IsFolderResourceTuple(tuple) {
			// Create a key without the condition for deduplication
			key := TupleStringWithoutCondition(tuple)
			if existing, exists := folderResourceTuples[key]; exists {
				// Merge this tuple with the existing one
				MergeFolderResourceTuples(existing, tuple)
			} else {
				folderResourceTuples[key] = tuple
			}
			continue
		}

		// For non-folder resource tuples, just add to the map
		tupleMap[tuple.String()] = tuple
	}

	// Collect all tuples
	tuples := make([]*openfgav1.TupleKey, 0, len(tupleMap)+len(folderResourceTuples))
	for _, t := range tupleMap {
		tuples = append(tuples, t)
	}
	for _, t := range folderResourceTuples {
		tuples = append(tuples, t)
	}

	return tuples, nil
}

// RoleToTuples converts role and its permissions (action/scope) to v1 TupleKey format
// using the shared ConvertRolePermissionsToTuples utility and common.ToAuthzExtTupleKeys
func RoleToTuples(roleUID string, permissions []*authzextv1.RolePermission) ([]*openfgav1.TupleKey, error) {
	// Convert to RolePermission
	rolePerms := make([]RolePermission, 0, len(permissions))
	for _, perm := range permissions {
		// Split the scope to get kind, attribute, identifier
		kind, _, identifier := splitScope(perm.Scope)
		rolePerms = append(rolePerms, RolePermission{
			Action:     perm.Action,
			Kind:       kind,
			Identifier: identifier,
		})
	}

	// Translate to Zanzana tuples
	tuples, err := ConvertRolePermissionsToTuples(roleUID, rolePerms)
	if err != nil {
		return nil, err
	}

	return tuples, nil
}

func splitScope(scope string) (string, string, string) {
	if scope == "" {
		return "", "", ""
	}

	fragments := strings.Split(scope, ":")
	switch l := len(fragments); l {
	case 1: // Splitting a wildcard scope "*" -> kind: "*"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[0], fragments[0]
	case 2: // Splitting a wildcard scope with specified kind "dashboards:*" -> kind: "dashboards"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[1], fragments[1]
	default: // Splitting a scope with all fields specified "dashboards:uid:my_dash" -> kind: "dashboards"; attribute: "uid"; identifier: "my_dash"
		return fragments[0], fragments[1], strings.Join(fragments[2:], ":")
	}
}

func GetRoleBindingTuple(subjectKind string, subjectName string, roleName string) (*openfgav1.TupleKey, error) {
	zanzanaType := ""
	subjectRelation := ""

	switch subjectKind {
	case string(iamv0.RoleBindingSpecSubjectKindUser):
		zanzanaType = TypeUser
	case string(iamv0.RoleBindingSpecSubjectKindTeam):
		zanzanaType = TypeTeam
		subjectRelation = RelationTeamMember
	case string(iamv0.RoleBindingSpecSubjectKindServiceAccount):
		zanzanaType = TypeServiceAccount
	case string(iamv0.RoleBindingSpecSubjectKindBasicRole):
		zanzanaType = TypeRole
		subjectRelation = RelationAssignee
	default:
		return nil, fmt.Errorf("invalid subject kind: %s", subjectKind)
	}

	tuple := &openfgav1.TupleKey{
		User:     NewTupleEntry(zanzanaType, subjectName, subjectRelation),
		Relation: RelationAssignee,
		Object:   NewTupleEntry(TypeRole, roleName, ""),
	}

	return tuple, nil
}

func GetResourcePermissionWriteTuple(req *authzextv1.CreatePermissionOperation) (*openfgav1.TupleKey, error) {
	resource := req.GetResource()
	permission := req.GetPermission()
	object := NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
	if err != nil {
		return nil, err
	}

	return tuple, nil
}

func GetResourcePermissionDeleteTuple(req *authzextv1.DeletePermissionOperation) (*openfgav1.TupleKeyWithoutCondition, error) {
	resource := req.GetResource()
	permission := req.GetPermission()
	object := NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
	if err != nil {
		return nil, err
	}

	return &openfgav1.TupleKeyWithoutCondition{
		User:     tuple.GetUser(),
		Relation: tuple.GetRelation(),
		Object:   tuple.GetObject(),
	}, nil
}

func toZanzanaType(apiGroup string) string {
	if apiGroup == "folder.grafana.app" {
		return TypeFolder
	}
	return TypeResource
}

func NewResourceTuple(object string, resource *authzextv1.Resource, perm *authzextv1.Permission) (*openfgav1.TupleKey, error) {
	// Typ is "folder" or "resource"
	typ := toZanzanaType(resource.Group)

	// subject
	subject, err := toZanzanaSubject(perm.GetKind(), perm.GetName())
	if err != nil {
		return nil, err
	}

	key := &openfgav1.TupleKey{
		// e.g. "user:{uid}", "serviceaccount:{uid}", "team:{uid}", "basicrole:{viewer|editor|admin}"
		User: subject,
		// "view", "edit", "admin"
		Relation: strings.ToLower(perm.Verb),
		// e.g. "folder:{name}" or "resource:{apiGroup}/{resource}/{name}"
		Object: object,
	}

	// For resources we add a condition to filter by apiGroup/resource
	// e.g "group_filter": {"group_resource": "dashboards.grafana.app/dashboards"}
	if typ == TypeResource {
		key.Condition = &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue(
						resource.GetGroup() + "/" + resource.GetResource(),
					),
				},
			},
		}
	}

	return key, nil
}

func toZanzanaSubject(kind string, name string) (string, error) {
	if name == "" {
		return "", errEmptyName
	}
	iamKind := iamv0.ResourcePermissionSpecPermissionKind(kind)
	switch iamKind {
	case iamv0.ResourcePermissionSpecPermissionKindUser:
		return NewTupleEntry(TypeUser, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
		return NewTupleEntry(TypeServiceAccount, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindTeam:
		return NewTupleEntry(TypeTeam, name, RelationTeamMember), nil
	case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
		basicRole := TranslateBasicRole(name)
		if basicRole == "" {
			return "", fmt.Errorf("%w: %s", errInvalidBasicRole, name)
		}

		// e.g role:basic_viewer#assignee
		return NewTupleEntry(TypeRole, basicRole, RelationAssignee), nil
	}

	// should not happen since we are after create
	// validation webhook should have caught invalid kinds
	return "", errUnknownKind
}

// GetTeamBindingTuple maps a team binding subject, team name, and permission to the corresponding
// Zanzana tuple. This is the canonical mapping used throughout the system.
func GetTeamBindingTuple(subject string, team string, permission string) (*openfgav1.TupleKey, error) {
	if subject == "" {
		return nil, errors.New("subject name cannot be empty")
	}

	if team == "" {
		return nil, errors.New("team name cannot be empty")
	}

	relation := ""
	switch permission {
	case string(iamv0.TeamBindingTeamPermissionAdmin):
		relation = RelationTeamAdmin
	case string(iamv0.TeamBindingTeamPermissionMember):
		relation = RelationTeamMember
	default:
		return nil, fmt.Errorf("unknown team permission '%s', expected member or admin", permission)
	}

	tuple := &openfgav1.TupleKey{
		User:     NewTupleEntry(TypeUser, subject, ""),
		Relation: relation,
		Object:   NewTupleEntry(TypeTeam, team, ""),
	}

	return tuple, nil
}

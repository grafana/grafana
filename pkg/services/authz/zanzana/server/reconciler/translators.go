package reconciler

import (
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/roleeffective"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

// TranslateFolderToTuples converts a Folder CRD to parent relationship tuples.
func TranslateFolderToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var folder folderv1.Folder
	if err := convertUnstructured(obj, &folder); err != nil {
		return nil, err
	}

	// Use MetaAccessor to get the parent folder UID
	accessor, err := utils.MetaAccessor(&folder)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	parentFolder := accessor.GetFolder()

	// No parent means this is a root-level folder
	if parentFolder == "" {
		return nil, nil
	}

	// Create parent relationship tuple: folder:child has parent folder:parent
	tuple := common.NewFolderParentTuple(folder.Name, parentFolder)
	return []*openfgav1.TupleKey{tuple}, nil
}

// TranslateRoleToTuples converts a Role CRD to permission tuples.
// For backward compatibility and test use — no RoleRef resolution.
func TranslateRoleToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	return translateRoleToTuples(obj, nil)
}

// translateRoleToTuples is the implementation of TranslateRoleToTuples.
// globalRolePerms, if non-nil, is used to resolve RoleRefs + PermissionsOmitted via the shared resolver.
func translateRoleToTuples(
	obj *unstructured.Unstructured,
	globalRolePerms map[string][]*authzextv1.RolePermission,
) ([]*openfgav1.TupleKey, error) {
	var role iamv0.Role
	if err := convertUnstructured(obj, &role); err != nil {
		return nil, err
	}

	var effective []roleeffective.ActionScope
	if globalRolePerms != nil {
		getter := func(roleName string) ([]roleeffective.ActionScope, error) {
			perms := globalRolePerms[roleName]
			out := make([]roleeffective.ActionScope, 0, len(perms))
			for _, p := range perms {
				out = append(out, roleeffective.ActionScope{Action: p.Action, Scope: p.Scope})
			}
			return out, nil
		}
		var hasRefs bool
		var err error
		effective, hasRefs, err = roleeffective.ResolveEffective(&role, getter)
		if err != nil {
			return nil, err
		}
		if !hasRefs {
			effective = roleSpecPermsToActionScopes(role.Spec.Permissions)
		}
	} else {
		effective = roleSpecPermsToActionScopes(role.Spec.Permissions)
	}

	perms := make([]*authzextv1.RolePermission, 0, len(effective))
	for _, p := range effective {
		perms = append(perms, &authzextv1.RolePermission{Action: p.Action, Scope: p.Scope})
	}
	return zanzana.RoleToTuples(role.Name, perms)
}

func roleSpecPermsToActionScopes(perms []iamv0.RolespecPermission) []roleeffective.ActionScope {
	out := make([]roleeffective.ActionScope, 0, len(perms))
	for _, p := range perms {
		out = append(out, roleeffective.ActionScope{Action: p.Action, Scope: p.Scope})
	}
	return out
}

// TranslateRoleBindingToTuples converts a RoleBinding CRD to assignee tuples.
func TranslateRoleBindingToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var rb iamv0.RoleBinding
	if err := convertUnstructured(obj, &rb); err != nil {
		return nil, err
	}

	subjectKind := string(rb.Spec.Subject.Kind)
	subjectName := rb.Spec.Subject.Name

	tuples := make([]*openfgav1.TupleKey, 0, len(rb.Spec.RoleRefs))
	for _, roleRef := range rb.Spec.RoleRefs {
		tuple, err := zanzana.GetRoleBindingTuple(subjectKind, subjectName, roleRef.Name)
		if err != nil {
			return nil, err
		}
		tuples = append(tuples, tuple)
	}

	return tuples, nil
}

// TranslateGlobalRoleBindingToTuples converts a GlobalRoleBinding CRD to assignee tuples.
// Subject kinds are the same as RoleBinding, so GetRoleBindingTuple is reused directly.
func TranslateGlobalRoleBindingToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var grb iamv0.GlobalRoleBinding
	if err := convertUnstructured(obj, &grb); err != nil {
		return nil, err
	}

	subjectKind := string(grb.Spec.Subject.Kind)
	subjectName := grb.Spec.Subject.Name

	tuples := make([]*openfgav1.TupleKey, 0, len(grb.Spec.RoleRefs))
	for _, roleRef := range grb.Spec.RoleRefs {
		tuple, err := zanzana.GetRoleBindingTuple(subjectKind, subjectName, roleRef.Name)
		if err != nil {
			return nil, err
		}
		tuples = append(tuples, tuple)
	}

	return tuples, nil
}

// TranslateResourcePermissionToTuples converts a ResourcePermission CRD to permission tuples.
func TranslateResourcePermissionToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var rp iamv0.ResourcePermission
	if err := convertUnstructured(obj, &rp); err != nil {
		return nil, err
	}

	resource := &authzextv1.Resource{
		Group:    rp.Spec.Resource.ApiGroup,
		Resource: rp.Spec.Resource.Resource,
		Name:     rp.Spec.Resource.Name,
	}

	tuples := make([]*openfgav1.TupleKey, 0, len(rp.Spec.Permissions))
	for _, perm := range rp.Spec.Permissions {
		tuple, err := zanzana.GetResourcePermissionWriteTuple(&authzextv1.CreatePermissionOperation{
			Resource: resource,
			Permission: &authzextv1.Permission{
				Kind: string(perm.Kind),
				Name: perm.Name,
				Verb: perm.Verb,
			},
		})
		if err != nil {
			return nil, err
		}
		tuples = append(tuples, tuple)
	}

	return tuples, nil
}

// TranslateTeamBindingToTuples converts a TeamBinding CRD to team membership tuples.
func TranslateTeamBindingToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var tb iamv0.TeamBinding
	if err := convertUnstructured(obj, &tb); err != nil {
		return nil, err
	}

	// Use the shared server logic to create the tuple
	tuple, err := zanzana.GetTeamBindingTuple(tb.Spec.Subject.Name, tb.Spec.TeamRef.Name, string(tb.Spec.Permission))
	if err != nil {
		return nil, err
	}

	return []*openfgav1.TupleKey{tuple}, nil
}

// TranslateUserToTuples converts a User CRD to basic role assignment tuples.
func TranslateUserToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var user iamv0.User
	if err := convertUnstructured(obj, &user); err != nil {
		return nil, err
	}

	// No role assigned means no tuple to create
	if user.Spec.Role == "" {
		return nil, nil
	}

	// Use the canonical basic role translation
	basicRole := common.TranslateBasicRole(user.Spec.Role)
	if basicRole == "" {
		return nil, fmt.Errorf("invalid basic role: %s", user.Spec.Role)
	}

	tuple := &openfgav1.TupleKey{
		User:     common.NewTupleEntry(common.TypeUser, user.Name, ""),
		Relation: common.RelationAssignee,
		Object:   common.NewTupleEntry(common.TypeRole, basicRole, ""),
	}
	return []*openfgav1.TupleKey{tuple}, nil
}

// TranslateServiceAccountToTuples converts a ServiceAccount CRD to basic role assignment tuples.
func TranslateServiceAccountToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var sa iamv0.ServiceAccount
	if err := convertUnstructured(obj, &sa); err != nil {
		return nil, err
	}

	role := string(sa.Spec.Role)
	if sa.Spec.Role == "" {
		return nil, nil
	}

	basicRole := common.TranslateBasicRole(role)
	if basicRole == "" {
		return nil, fmt.Errorf("invalid basic role: %s", role)
	}

	tuple := &openfgav1.TupleKey{
		User:     common.NewTupleEntry(common.TypeServiceAccount, sa.Name, ""),
		Relation: common.RelationAssignee,
		Object:   common.NewTupleEntry(common.TypeRole, basicRole, ""),
	}
	return []*openfgav1.TupleKey{tuple}, nil
}

// convertUnstructured converts an unstructured object to a typed struct using the standard Kubernetes converter.
func convertUnstructured(obj *unstructured.Unstructured, target any) error {
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, target); err != nil {
		return fmt.Errorf("failed to convert to typed object: %w", err)
	}
	return nil
}

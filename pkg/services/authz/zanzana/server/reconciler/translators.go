package reconciler

import (
	"fmt"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server"
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

	// Create parent relationship tuple: folder:parent -> parent -> folder:child
	tuple := common.NewFolderParentTuple(parentFolder, folder.Name)
	return []*openfgav1.TupleKey{tuple}, nil
}

// TranslateRoleToTuples converts a Role CRD to permission tuples.
func TranslateRoleToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var role iamv0.Role
	if err := convertUnstructured(obj, &role); err != nil {
		return nil, err
	}

	permissions := make([]*authzextv1.RolePermission, 0, len(role.Spec.Permissions))
	for _, perm := range role.Spec.Permissions {
		permissions = append(permissions, &authzextv1.RolePermission{
			Action: perm.Action,
			Scope:  perm.Scope,
		})
	}

	return server.RoleToTuples(role.Name, permissions)
}

// TranslateRoleBindingToTuples converts a RoleBinding CRD to assignee tuples.
func TranslateRoleBindingToTuples(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
	var rb iamv0.RoleBinding
	if err := convertUnstructured(obj, &rb); err != nil {
		return nil, err
	}

	subjectKind := string(rb.Spec.Subject.Kind)
	subjectName := rb.Spec.Subject.Name

	var tuples []*openfgav1.TupleKey
	for _, roleRef := range rb.Spec.RoleRefs {
		tuple, err := server.GetRoleBindingTuple(subjectKind, subjectName, roleRef.Name)
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

	var tuples []*openfgav1.TupleKey
	for _, perm := range rp.Spec.Permissions {
		tuple, err := server.GetResourcePermissionWriteTuple(&authzextv1.CreatePermissionOperation{
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
	tuple, err := server.GetTeamBindingTuple(tb.Spec.Subject.Name, tb.Spec.TeamRef.Name, string(tb.Spec.Permission))
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
		User:     common.NewTupleEntry(common.TypeUser, user.Spec.Role, ""),
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

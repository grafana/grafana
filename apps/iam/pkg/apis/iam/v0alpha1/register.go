package v0alpha1

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/fieldselectors"
)

const (
	GROUP      = "iam.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var CoreRoleInfo = utils.NewResourceInfo(GROUP, VERSION,
	"coreroles", "corerole", "CoreRole",
	func() runtime.Object { return &CoreRole{} },
	func() runtime.Object { return &CoreRoleList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Group", Type: "string", Format: "group", Description: "Core role group"},
			{Name: "Title", Type: "string", Format: "string", Description: "Core role name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			core, ok := obj.(*CoreRole)
			if ok {
				if core != nil {
					return []interface{}{
						core.Name,
						core.Spec.Group,
						core.Spec.Title,
						core.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected core role")
		},
	},
)

var RoleInfo = utils.NewResourceInfo(GROUP, VERSION,
	"roles", "role", "Role",
	func() runtime.Object { return &Role{} },
	func() runtime.Object { return &RoleList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Group", Type: "string", Format: "group", Description: "Role group"},
			{Name: "Title", Type: "string", Format: "string", Description: "Role name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			role, ok := obj.(*Role)
			if ok {
				if role != nil {
					return []interface{}{
						role.Name,
						role.Spec.Group,
						role.Spec.Title,
						role.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected role")
		},
	},
)

var GlobalRoleInfo = globalRoleInfo.WithClusterScope()
var globalRoleInfo = utils.NewResourceInfo(GROUP, VERSION,
	"globalroles", "globalrole", "GlobalRole",
	func() runtime.Object { return &GlobalRole{} },
	func() runtime.Object { return &GlobalRoleList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Group", Type: "string", Format: "group", Description: "Role group"},
			{Name: "Title", Type: "string", Format: "string", Description: "Role name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			globalRole, ok := obj.(*GlobalRole)
			if ok {
				return []interface{}{
					globalRole.Name,
					globalRole.Spec.Group,
					globalRole.Spec.Title,
					globalRole.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected global role")
		},
	},
)

var ResourcePermissionInfo = utils.NewResourceInfo(GROUP, VERSION,
	"resourcepermissions", "resourcepermission", "ResourcePermission",
	func() runtime.Object { return &ResourcePermission{} },
	func() runtime.Object { return &ResourcePermissionList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			perm, ok := obj.(*ResourcePermission)
			if ok {
				if perm != nil {
					return []interface{}{
						perm.Name,
						perm.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected resource permission")
		},
	},
)

var userKind = UserKind()
var UserResourceInfo = utils.NewResourceInfo(userKind.Group(), userKind.Version(),
	userKind.GroupVersionResource().Resource, strings.ToLower(userKind.Kind()), userKind.Kind(),
	func() runtime.Object { return userKind.ZeroValue() },
	func() runtime.Object { return userKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Login", Type: "string", Format: "string", Description: "The user login"},
			{Name: "Email", Type: "string", Format: "string", Description: "The user email"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			u, ok := obj.(*User)
			if ok {
				return []interface{}{
					u.Name,
					u.Spec.Login,
					u.Spec.Email,
					u.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected user")
		},
	},
)

var teamKind = TeamKind()
var TeamResourceInfo = utils.NewResourceInfo(teamKind.Group(), teamKind.Version(),
	teamKind.GroupVersionResource().Resource, strings.ToLower(teamKind.Kind()), teamKind.Kind(),
	func() runtime.Object { return teamKind.ZeroValue() },
	func() runtime.Object { return teamKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The team name"},
			{Name: "Email", Type: "string", Format: "string", Description: "team email"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Team)
			if !ok {
				return nil, fmt.Errorf("expected team")
			}
			return []interface{}{
				m.Name,
				m.Spec.Title,
				m.Spec.Email,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var serviceAccountKind = ServiceAccountKind()
var ServiceAccountResourceInfo = utils.NewResourceInfo(serviceAccountKind.Group(), serviceAccountKind.Version(),
	serviceAccountKind.GroupVersionResource().Resource, strings.ToLower(serviceAccountKind.Kind()), serviceAccountKind.Kind(),
	func() runtime.Object { return serviceAccountKind.ZeroValue() },
	func() runtime.Object { return serviceAccountKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string"},
			{Name: "Disabled", Type: "boolean"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			sa, ok := obj.(*ServiceAccount)
			if ok {
				return []interface{}{
					sa.Name,
					sa.Spec.Title,
					sa.Spec.Disabled,
					sa.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected service account")
		},
	},
)

var teamBindingKind = TeamBindingKind()
var TeamBindingResourceInfo = utils.NewResourceInfo(
	teamBindingKind.Group(), teamBindingKind.Version(),
	teamBindingKind.GroupVersionResource().Resource,
	strings.ToLower(teamBindingKind.Kind()), teamBindingKind.Kind(),
	func() runtime.Object { return teamBindingKind.ZeroValue() },
	func() runtime.Object { return teamBindingKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Team", Type: "string"},
			{Name: "Created At", Type: "string", Format: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*TeamBinding)
			if !ok {
				return nil, fmt.Errorf("expected team binding")
			}
			return []interface{}{
				m.Name,
				m.Spec.TeamRef.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var teamLBACRuleKind = TeamLBACRuleKind()
var TeamLBACRuleInfo = utils.NewResourceInfo(
	teamLBACRuleKind.Group(), teamLBACRuleKind.Version(),
	teamLBACRuleKind.GroupVersionResource().Resource,
	strings.ToLower(teamLBACRuleKind.Kind()), teamLBACRuleKind.Kind(),
	func() runtime.Object { return teamLBACRuleKind.ZeroValue() },
	func() runtime.Object { return teamLBACRuleKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Datasource Type", Type: "string", Format: "string", Description: "Data source type"},
			{Name: "Datasource UID", Type: "string", Format: "string", Description: "Data source UID"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			t, ok := obj.(*TeamLBACRule)
			if !ok {
				return nil, fmt.Errorf("expected teamlbacrule")
			}
			return []interface{}{
				t.Name,
				t.Spec.DatasourceType,
				t.Spec.DatasourceUid,
				t.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var ExternalGroupMappingResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"externalgroupmappings", "externalgroupmapping", "ExternalGroupMapping",
	func() runtime.Object { return &ExternalGroupMapping{} },
	func() runtime.Object { return &ExternalGroupMappingList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			mapping, ok := obj.(*ExternalGroupMapping)
			if ok {
				if mapping != nil {
					return []interface{}{
						mapping.Name,
						mapping.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected external group mapping")
		},
	},
)

var RoleBindingInfo = utils.NewResourceInfo(GROUP, VERSION,
	"rolebindings", "rolebinding", "RoleBinding",
	func() runtime.Object { return &RoleBinding{} },
	func() runtime.Object { return &RoleBindingList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			roleBinding, ok := obj.(*RoleBinding)
			if ok {
				if roleBinding != nil {
					return []interface{}{
						roleBinding.Name,
						roleBinding.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected role binding")
		},
	},
)

var (
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme

	SchemeGroupVersion   = schema.GroupVersion{Group: GROUP, Version: VERSION}
	InternalGroupVersion = schema.GroupVersion{Group: GROUP, Version: runtime.APIVersionInternal}
)

func init() {
	localSchemeBuilder.Register(func(s *runtime.Scheme) error {
		err := AddAuthZKnownTypes(s)
		if err != nil {
			return err
		}

		err = AddAuthNKnownTypes(s)
		if err != nil {
			return err
		}

		metav1.AddToGroupVersion(s, SchemeGroupVersion)
		return nil
	}, addDefaultingFuncs)
}

func AddAuthZKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&CoreRole{},
		&CoreRoleList{},
		&Role{},
		&RoleList{},
		&RoleBinding{},
		&RoleBindingList{},

		// What is this about?
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
	return nil
}

func AddTeamLBACRuleTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&TeamLBACRule{},
		&TeamLBACRuleList{},

		// What is this about?
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
	return nil
}

func AddResourcePermissionKnownTypes(scheme *runtime.Scheme, version schema.GroupVersion) error {
	scheme.AddKnownTypes(version,
		&ResourcePermission{},
		&ResourcePermissionList{},

		// What is this about?
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
	return nil
}

func AddGlobalRoleKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&GlobalRole{},
		&GlobalRoleList{},
	)
	return nil
}

func AddAuthNKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		// Identity
		&User{},
		&UserList{},
		&ServiceAccount{},
		&ServiceAccountList{},
		&Team{},
		&TeamList{},
		&GetSearchTeamsResponse{},
		&TeamBinding{},
		&TeamBindingList{},
		&ExternalGroupMapping{},
		&ExternalGroupMappingList{},
		&GetGroupsResponse{},
		&GetMembersResponse{},
		// For now these are registered in pkg/apis/iam/v0alpha1/register.go
		// &UserTeamList{},
		// &ServiceAccountTokenList{},
		// &DisplayList{},
		// &SSOSetting{},
		// &SSOSettingList{},

		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)

	// Enable field selectors for TeamBinding
	err := fieldselectors.AddSelectableFieldLabelConversions(scheme, SchemeGroupVersion, TeamBindingKind())
	if err != nil {
		return err
	}

	// Enable field selectors for ExternalGroupMapping
	err = fieldselectors.AddSelectableFieldLabelConversions(scheme, SchemeGroupVersion, ExternalGroupMappingKind())
	if err != nil {
		return err
	}
	return nil
}

func addDefaultingFuncs(scheme *runtime.Scheme) error {
	// return RegisterDefaults(scheme)
	return nil
}

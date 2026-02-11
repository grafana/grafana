package v0alpha1

import (
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	common "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		iamv0alpha1.CoreRole{}.OpenAPIModelName():                                                         schema_pkg_apis_iam_v0alpha1_CoreRole(ref),
		iamv0alpha1.CoreRoleList{}.OpenAPIModelName():                                                     schema_pkg_apis_iam_v0alpha1_CoreRoleList(ref),
		iamv0alpha1.CoreRoleSpec{}.OpenAPIModelName():                                                     schema_pkg_apis_iam_v0alpha1_CoreRoleSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.CoreRoleStatus":                        schema_pkg_apis_iam_v0alpha1_CoreRoleStatus(ref),
		iamv0alpha1.CoreRolespecPermission{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_CoreRolespecPermission(ref),
		iamv0alpha1.CoreRolespecRoleRef{}.OpenAPIModelName():                                              schema_pkg_apis_iam_v0alpha1_CoreRolespecRoleRef(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.CoreRolestatusOperatorState":           schema_pkg_apis_iam_v0alpha1_CoreRolestatusOperatorState(ref),
		iamv0alpha1.ExternalGroupMapping{}.OpenAPIModelName():                                             schema_pkg_apis_iam_v0alpha1_ExternalGroupMapping(ref),
		iamv0alpha1.ExternalGroupMappingList{}.OpenAPIModelName():                                         schema_pkg_apis_iam_v0alpha1_ExternalGroupMappingList(ref),
		iamv0alpha1.ExternalGroupMappingSpec{}.OpenAPIModelName():                                         schema_pkg_apis_iam_v0alpha1_ExternalGroupMappingSpec(ref),
		iamv0alpha1.ExternalGroupMappingTeamRef{}.OpenAPIModelName():                                      schema_pkg_apis_iam_v0alpha1_ExternalGroupMappingTeamRef(ref),
		iamv0alpha1.GetGroupsBody{}.OpenAPIModelName():                                                    schema_pkg_apis_iam_v0alpha1_GetGroupsBody(ref),
		iamv0alpha1.GetGroupsExternalGroupMapping{}.OpenAPIModelName():                                    schema_pkg_apis_iam_v0alpha1_GetGroupsExternalGroupMapping(ref),
		iamv0alpha1.GetGroupsResponse{}.OpenAPIModelName():                                                schema_pkg_apis_iam_v0alpha1_GetGroupsResponse(ref),
		iamv0alpha1.GetMembersBody{}.OpenAPIModelName():                                                   schema_pkg_apis_iam_v0alpha1_GetMembersBody(ref),
		iamv0alpha1.GetMembersResponse{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_GetMembersResponse(ref),
		iamv0alpha1.GetMembersTeamUser{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_GetMembersTeamUser(ref),
		iamv0alpha1.GetSearchTeamsBody{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_GetSearchTeamsBody(ref),
		iamv0alpha1.GetSearchTeamsResponse{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_GetSearchTeamsResponse(ref),
		iamv0alpha1.GetSearchTeamsTeamHit{}.OpenAPIModelName():                                            schema_pkg_apis_iam_v0alpha1_GetSearchTeamsTeamHit(ref),
		iamv0alpha1.GetSearchUsersResponse{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_GetSearchUsersResponse(ref),
		iamv0alpha1.GetSearchUsersUserHit{}.OpenAPIModelName():                                            schema_pkg_apis_iam_v0alpha1_GetSearchUsersUserHit(ref),
		iamv0alpha1.GetTeamsBody{}.OpenAPIModelName():                                                     schema_pkg_apis_iam_v0alpha1_GetTeamsBody(ref),
		iamv0alpha1.GetTeamsResponse{}.OpenAPIModelName():                                                 schema_pkg_apis_iam_v0alpha1_GetTeamsResponse(ref),
		iamv0alpha1.GetTeamsUserTeam{}.OpenAPIModelName():                                                 schema_pkg_apis_iam_v0alpha1_GetTeamsUserTeam(ref),
		iamv0alpha1.GlobalRole{}.OpenAPIModelName():                                                       schema_pkg_apis_iam_v0alpha1_GlobalRole(ref),
		iamv0alpha1.GlobalRoleBinding{}.OpenAPIModelName():                                                schema_pkg_apis_iam_v0alpha1_GlobalRoleBinding(ref),
		iamv0alpha1.GlobalRoleBindingList{}.OpenAPIModelName():                                            schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingList(ref),
		iamv0alpha1.GlobalRoleBindingSpec{}.OpenAPIModelName():                                            schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRoleBindingStatus":               schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingStatus(ref),
		iamv0alpha1.GlobalRoleBindingspecRoleRef{}.OpenAPIModelName():                                     schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingspecRoleRef(ref),
		iamv0alpha1.GlobalRoleBindingspecSubject{}.OpenAPIModelName():                                     schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingspecSubject(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRoleBindingstatusOperatorState":  schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingstatusOperatorState(ref),
		iamv0alpha1.GlobalRoleList{}.OpenAPIModelName():                                                   schema_pkg_apis_iam_v0alpha1_GlobalRoleList(ref),
		iamv0alpha1.GlobalRoleSpec{}.OpenAPIModelName():                                                   schema_pkg_apis_iam_v0alpha1_GlobalRoleSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRoleStatus":                      schema_pkg_apis_iam_v0alpha1_GlobalRoleStatus(ref),
		iamv0alpha1.GlobalRolespecPermission{}.OpenAPIModelName():                                         schema_pkg_apis_iam_v0alpha1_GlobalRolespecPermission(ref),
		iamv0alpha1.GlobalRolespecRoleRef{}.OpenAPIModelName():                                            schema_pkg_apis_iam_v0alpha1_GlobalRolespecRoleRef(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRolestatusOperatorState":         schema_pkg_apis_iam_v0alpha1_GlobalRolestatusOperatorState(ref),
		iamv0alpha1.ResourcePermission{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_ResourcePermission(ref),
		iamv0alpha1.ResourcePermissionList{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_ResourcePermissionList(ref),
		iamv0alpha1.ResourcePermissionSpec{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_ResourcePermissionSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ResourcePermissionStatus":              schema_pkg_apis_iam_v0alpha1_ResourcePermissionStatus(ref),
		iamv0alpha1.ResourcePermissionspecPermission{}.OpenAPIModelName():                                 schema_pkg_apis_iam_v0alpha1_ResourcePermissionspecPermission(ref),
		iamv0alpha1.ResourcePermissionspecResource{}.OpenAPIModelName():                                   schema_pkg_apis_iam_v0alpha1_ResourcePermissionspecResource(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ResourcePermissionstatusOperatorState": schema_pkg_apis_iam_v0alpha1_ResourcePermissionstatusOperatorState(ref),
		iamv0alpha1.Role{}.OpenAPIModelName():                                                             schema_pkg_apis_iam_v0alpha1_Role(ref),
		iamv0alpha1.RoleBinding{}.OpenAPIModelName():                                                      schema_pkg_apis_iam_v0alpha1_RoleBinding(ref),
		iamv0alpha1.RoleBindingList{}.OpenAPIModelName():                                                  schema_pkg_apis_iam_v0alpha1_RoleBindingList(ref),
		iamv0alpha1.RoleBindingSpec{}.OpenAPIModelName():                                                  schema_pkg_apis_iam_v0alpha1_RoleBindingSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RoleBindingStatus":                     schema_pkg_apis_iam_v0alpha1_RoleBindingStatus(ref),
		iamv0alpha1.RoleBindingspecRoleRef{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_RoleBindingspecRoleRef(ref),
		iamv0alpha1.RoleBindingspecSubject{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_RoleBindingspecSubject(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RoleBindingstatusOperatorState":        schema_pkg_apis_iam_v0alpha1_RoleBindingstatusOperatorState(ref),
		iamv0alpha1.RoleList{}.OpenAPIModelName():                                                         schema_pkg_apis_iam_v0alpha1_RoleList(ref),
		iamv0alpha1.RoleSpec{}.OpenAPIModelName():                                                         schema_pkg_apis_iam_v0alpha1_RoleSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RoleStatus":                            schema_pkg_apis_iam_v0alpha1_RoleStatus(ref),
		iamv0alpha1.RolespecPermission{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_RolespecPermission(ref),
		iamv0alpha1.RolespecRoleRef{}.OpenAPIModelName():                                                  schema_pkg_apis_iam_v0alpha1_RolespecRoleRef(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RolestatusOperatorState":               schema_pkg_apis_iam_v0alpha1_RolestatusOperatorState(ref),
		iamv0alpha1.ServiceAccount{}.OpenAPIModelName():                                                   schema_pkg_apis_iam_v0alpha1_ServiceAccount(ref),
		iamv0alpha1.ServiceAccountList{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_ServiceAccountList(ref),
		iamv0alpha1.ServiceAccountSpec{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_ServiceAccountSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ServiceAccountStatus":                  schema_pkg_apis_iam_v0alpha1_ServiceAccountStatus(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ServiceAccountstatusOperatorState":     schema_pkg_apis_iam_v0alpha1_ServiceAccountstatusOperatorState(ref),
		iamv0alpha1.Team{}.OpenAPIModelName():                                                             schema_pkg_apis_iam_v0alpha1_Team(ref),
		iamv0alpha1.TeamBinding{}.OpenAPIModelName():                                                      schema_pkg_apis_iam_v0alpha1_TeamBinding(ref),
		iamv0alpha1.TeamBindingList{}.OpenAPIModelName():                                                  schema_pkg_apis_iam_v0alpha1_TeamBindingList(ref),
		iamv0alpha1.TeamBindingSpec{}.OpenAPIModelName():                                                  schema_pkg_apis_iam_v0alpha1_TeamBindingSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamBindingStatus":                     schema_pkg_apis_iam_v0alpha1_TeamBindingStatus(ref),
		iamv0alpha1.TeamBindingTeamRef{}.OpenAPIModelName():                                               schema_pkg_apis_iam_v0alpha1_TeamBindingTeamRef(ref),
		iamv0alpha1.TeamBindingspecSubject{}.OpenAPIModelName():                                           schema_pkg_apis_iam_v0alpha1_TeamBindingspecSubject(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamBindingstatusOperatorState":        schema_pkg_apis_iam_v0alpha1_TeamBindingstatusOperatorState(ref),
		iamv0alpha1.TeamLBACRule{}.OpenAPIModelName():                                                     schema_pkg_apis_iam_v0alpha1_TeamLBACRule(ref),
		iamv0alpha1.TeamLBACRuleList{}.OpenAPIModelName():                                                 schema_pkg_apis_iam_v0alpha1_TeamLBACRuleList(ref),
		iamv0alpha1.TeamLBACRuleSpec{}.OpenAPIModelName():                                                 schema_pkg_apis_iam_v0alpha1_TeamLBACRuleSpec(ref),
		iamv0alpha1.TeamList{}.OpenAPIModelName():                                                         schema_pkg_apis_iam_v0alpha1_TeamList(ref),
		iamv0alpha1.TeamSpec{}.OpenAPIModelName():                                                         schema_pkg_apis_iam_v0alpha1_TeamSpec(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamStatus":                            schema_pkg_apis_iam_v0alpha1_TeamStatus(ref),
		"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamstatusOperatorState":               schema_pkg_apis_iam_v0alpha1_TeamstatusOperatorState(ref),
		iamv0alpha1.User{}.OpenAPIModelName():                                                             schema_pkg_apis_iam_v0alpha1_User(ref),
		iamv0alpha1.UserList{}.OpenAPIModelName():                                                         schema_pkg_apis_iam_v0alpha1_UserList(ref),
		iamv0alpha1.UserSpec{}.OpenAPIModelName():                                                         schema_pkg_apis_iam_v0alpha1_UserSpec(ref),
		iamv0alpha1.UserStatus{}.OpenAPIModelName():                                                       schema_pkg_apis_iam_v0alpha1_UserStatus(ref),
	}
}

func schema_pkg_apis_iam_v0alpha1_CoreRole(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the CoreRole",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.CoreRoleSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.CoreRoleSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_CoreRoleList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.CoreRole{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.CoreRole{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_CoreRoleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Description: "Display name of the role",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"description": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"group": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"permissions": {
						SchemaProps: spec.SchemaProps{
							Description: "Added permissions (permissions in actual role but NOT in seed) - for basic roles only. For custom roles, this contains all permissions.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.CoreRolespecPermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"permissionsOmitted": {
						SchemaProps: spec.SchemaProps{
							Description: "Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles only",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.CoreRolespecPermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"roleRefs": {
						SchemaProps: spec.SchemaProps{
							Description: "Roles to take permissions from (for now the list should be of size 1) delegatable?: bool created? updated?",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.CoreRolespecRoleRef{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"title", "description", "group", "permissions", "permissionsOmitted"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.CoreRolespecPermission{}.OpenAPIModelName(), iamv0alpha1.CoreRolespecRoleRef{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_CoreRoleStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.CoreRolestatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.CoreRolestatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_CoreRolespecPermission(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"action": {
						SchemaProps: spec.SchemaProps{
							Description: "RBAC action (e.g: \"dashbaords:read\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"scope": {
						SchemaProps: spec.SchemaProps{
							Description: "RBAC scope (e.g: \"dashboards:uid:dash1\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"action", "scope"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_CoreRolespecRoleRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind of role being referenced (for now only GlobalRole is supported)",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "Name of the role being referenced",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_CoreRolestatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_ExternalGroupMapping(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the ExternalGroupMapping",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.ExternalGroupMappingSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ExternalGroupMappingSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ExternalGroupMappingList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.ExternalGroupMapping{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ExternalGroupMapping{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ExternalGroupMappingSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"teamRef": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(iamv0alpha1.ExternalGroupMappingTeamRef{}.OpenAPIModelName()),
						},
					},
					"externalGroupId": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"teamRef", "externalGroupId"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ExternalGroupMappingTeamRef{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_ExternalGroupMappingTeamRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "Name is the unique identifier for a team.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetGroupsBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetGroupsExternalGroupMapping{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetGroupsExternalGroupMapping{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetGroupsExternalGroupMapping(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"externalGroup": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"name", "externalGroup"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetGroupsResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetGroupsExternalGroupMapping{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetGroupsExternalGroupMapping{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetMembersBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetMembersTeamUser{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetMembersTeamUser{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetMembersResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetMembersTeamUser{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetMembersTeamUser{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetMembersTeamUser(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"team": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"user": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"permission": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"external": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
				},
				Required: []string{"team", "user", "permission", "external"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetSearchTeamsBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"offset": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
					"totalHits": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
					"hits": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetSearchTeamsTeamHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"queryCost": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"number"},
							Format:  "double",
						},
					},
					"maxScore": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"number"},
							Format:  "double",
						},
					},
				},
				Required: []string{"offset", "totalHits", "hits", "queryCost", "maxScore"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetSearchTeamsTeamHit{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetSearchTeamsResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"offset": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
					"totalHits": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
					"hits": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetSearchTeamsTeamHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"queryCost": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"number"},
							Format:  "double",
						},
					},
					"maxScore": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"number"},
							Format:  "double",
						},
					},
				},
				Required: []string{"offset", "totalHits", "hits", "queryCost", "maxScore"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetSearchTeamsTeamHit{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetSearchTeamsTeamHit(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"title": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"email": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"provisioned": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"externalUID": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"name", "title", "email", "provisioned", "externalUID"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetSearchUsersResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"offset": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
					"totalHits": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
					"hits": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetSearchUsersUserHit{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"queryCost": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"number"},
							Format:  "double",
						},
					},
					"maxScore": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"number"},
							Format:  "double",
						},
					},
				},
				Required: []string{"offset", "totalHits", "hits", "queryCost", "maxScore"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetSearchUsersUserHit{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetSearchUsersUserHit(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"title": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"login": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"email": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"role": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"lastSeenAt": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
					"lastSeenAtAge": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"provisioned": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"score": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"number"},
							Format:  "double",
						},
					},
				},
				Required: []string{"name", "title", "login", "email", "role", "lastSeenAt", "lastSeenAtAge", "provisioned", "score"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetTeamsBody(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetTeamsUserTeam{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetTeamsUserTeam{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetTeamsResponse(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GetTeamsUserTeam{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GetTeamsUserTeam{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GetTeamsUserTeam(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"user": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"team": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"permission": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"external": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
				},
				Required: []string{"user", "team", "permission", "external"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRole(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the GlobalRole",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.GlobalRoleSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GlobalRoleSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleBinding(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the GlobalRoleBinding",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.GlobalRoleBindingSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GlobalRoleBindingSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GlobalRoleBinding{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GlobalRoleBinding{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"subject": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(iamv0alpha1.GlobalRoleBindingspecSubject{}.OpenAPIModelName()),
						},
					},
					"roleRefs": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GlobalRoleBindingspecRoleRef{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"subject", "roleRefs"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GlobalRoleBindingspecRoleRef{}.OpenAPIModelName(), iamv0alpha1.GlobalRoleBindingspecSubject{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRoleBindingstatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRoleBindingstatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingspecRoleRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "kind of role",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "uid of the role",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingspecSubject(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "kind of the identity getting the permission",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "uid of the identity",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleBindingstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GlobalRole{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GlobalRole{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Description: "Display name of the role",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"description": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"group": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"permissions": {
						SchemaProps: spec.SchemaProps{
							Description: "Added permissions (permissions in actual role but NOT in seed) - for basic roles only. For custom roles, this contains all permissions.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GlobalRolespecPermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"permissionsOmitted": {
						SchemaProps: spec.SchemaProps{
							Description: "Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles only",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GlobalRolespecPermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"roleRefs": {
						SchemaProps: spec.SchemaProps{
							Description: "Roles to take permissions from (for now the list should be of size 1) delegatable?: bool created? updated?",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.GlobalRolespecRoleRef{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"title", "description", "group", "permissions", "permissionsOmitted"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.GlobalRolespecPermission{}.OpenAPIModelName(), iamv0alpha1.GlobalRolespecRoleRef{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRoleStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRolestatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GlobalRolestatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRolespecPermission(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"action": {
						SchemaProps: spec.SchemaProps{
							Description: "RBAC action (e.g: \"dashbaords:read\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"scope": {
						SchemaProps: spec.SchemaProps{
							Description: "RBAC scope (e.g: \"dashboards:uid:dash1\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"action", "scope"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRolespecRoleRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind of role being referenced (for now only GlobalRole is supported)",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "Name of the role being referenced",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_GlobalRolestatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_ResourcePermission(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the ResourcePermission",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.ResourcePermissionSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ResourcePermissionSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ResourcePermissionList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.ResourcePermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ResourcePermission{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ResourcePermissionSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"resource": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(iamv0alpha1.ResourcePermissionspecResource{}.OpenAPIModelName()),
						},
					},
					"permissions": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.ResourcePermissionspecPermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"resource", "permissions"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ResourcePermissionspecPermission{}.OpenAPIModelName(), iamv0alpha1.ResourcePermissionspecResource{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_ResourcePermissionStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ResourcePermissionstatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ResourcePermissionstatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ResourcePermissionspecPermission(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "kind of the identity getting the permission",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "uid of the identity getting the permission",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"verb": {
						SchemaProps: spec.SchemaProps{
							Description: "action set granted to the user (e.g. \"admin\" or \"edit\", \"view\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name", "verb"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_ResourcePermissionspecResource(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"apiGroup": {
						SchemaProps: spec.SchemaProps{
							Description: "api group of the resource (e.g: \"folder.grafana.app\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"resource": {
						SchemaProps: spec.SchemaProps{
							Description: "kind of the resource (e.g: \"folders\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "uid of the resource (e.g: \"fold1\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"apiGroup", "resource", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_ResourcePermissionstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_Role(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the Role",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.RoleSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.RoleSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleBinding(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the RoleBinding",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.RoleBindingSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.RoleBindingSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleBindingList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.RoleBinding{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.RoleBinding{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleBindingSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"subject": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(iamv0alpha1.RoleBindingspecSubject{}.OpenAPIModelName()),
						},
					},
					"roleRefs": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.RoleBindingspecRoleRef{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"subject", "roleRefs"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.RoleBindingspecRoleRef{}.OpenAPIModelName(), iamv0alpha1.RoleBindingspecSubject{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleBindingStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RoleBindingstatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RoleBindingstatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleBindingspecRoleRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "kind of role",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "uid of the role",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleBindingspecSubject(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "kind of the identity getting the permission",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "uid of the identity",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleBindingstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.Role{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.Role{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Description: "Display name of the role",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"description": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"group": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"permissions": {
						SchemaProps: spec.SchemaProps{
							Description: "Added permissions (permissions in actual role but NOT in seed) - for basic roles only. For custom roles, this contains all permissions.",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.RolespecPermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"permissionsOmitted": {
						SchemaProps: spec.SchemaProps{
							Description: "Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles only",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.RolespecPermission{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
					"roleRefs": {
						SchemaProps: spec.SchemaProps{
							Description: "Roles to take permissions from (for now the list should be of size 1) delegatable?: bool created? updated?",
							Type:        []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.RolespecRoleRef{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"title", "description", "group", "permissions", "permissionsOmitted"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.RolespecPermission{}.OpenAPIModelName(), iamv0alpha1.RolespecRoleRef{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_RoleStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RolestatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.RolestatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_RolespecPermission(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"action": {
						SchemaProps: spec.SchemaProps{
							Description: "RBAC action (e.g: \"dashbaords:read\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"scope": {
						SchemaProps: spec.SchemaProps{
							Description: "RBAC scope (e.g: \"dashboards:uid:dash1\")",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"action", "scope"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_RolespecRoleRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind of role being referenced (for now only GlobalRole is supported)",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "Name of the role being referenced",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"kind", "name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_RolestatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_ServiceAccount(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the ServiceAccount",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.ServiceAccountSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ServiceAccountSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ServiceAccountList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.ServiceAccount{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.ServiceAccount{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ServiceAccountSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"disabled": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"plugin": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"role": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"title": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"disabled", "plugin", "role", "title"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_ServiceAccountStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ServiceAccountstatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ServiceAccountstatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_ServiceAccountstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_Team(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the Team",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.TeamSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.TeamSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamBinding(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the TeamBinding",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.TeamBindingSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.TeamBindingSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamBindingList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.TeamBinding{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.TeamBinding{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamBindingSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"subject": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(iamv0alpha1.TeamBindingspecSubject{}.OpenAPIModelName()),
						},
					},
					"teamRef": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(iamv0alpha1.TeamBindingTeamRef{}.OpenAPIModelName()),
						},
					},
					"permission": {
						SchemaProps: spec.SchemaProps{
							Description: "permission of the identity in the team",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"external": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
				},
				Required: []string{"subject", "teamRef", "permission", "external"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.TeamBindingTeamRef{}.OpenAPIModelName(), iamv0alpha1.TeamBindingspecSubject{}.OpenAPIModelName()},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamBindingStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamBindingstatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamBindingstatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamBindingTeamRef(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "Name is the unique identifier for a team.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamBindingspecSubject(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"name": {
						SchemaProps: spec.SchemaProps{
							Description: "uid of the identity",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
				},
				Required: []string{"name"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamBindingstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamLBACRule(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the TeamLBACRule",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.TeamLBACRuleSpec{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.TeamLBACRuleSpec{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamLBACRuleList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.TeamLBACRule{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.TeamLBACRule{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamLBACRuleSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"datasource_uid": {
						SchemaProps: spec.SchemaProps{
							Description: "Data source UID that this TeamLBAC Rule applies to",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"datasource_type": {
						SchemaProps: spec.SchemaProps{
							Description: "Data source type that this TeamLBAC Rule applies to",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"team_filters": {
						SchemaProps: spec.SchemaProps{
							Description: "Map of team UIDs to their filter lists Each team can have multiple filters",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type: []string{"array"},
										Items: &spec.SchemaOrArray{
											Schema: &spec.Schema{
												SchemaProps: spec.SchemaProps{
													Default: "",
													Type:    []string{"string"},
													Format:  "",
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Required: []string{"datasource_uid", "datasource_type", "team_filters"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.Team{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.Team{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"title": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"email": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"provisioned": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"externalUID": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"title", "email", "provisioned", "externalUID"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"operatorStates": {
						SchemaProps: spec.SchemaProps{
							Description: "operatorStates is a map of operator ID to operator state evaluations. Any operator which consumes this kind SHOULD add its state evaluation information to this field.",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref("github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamstatusOperatorState"),
									},
								},
							},
						},
					},
					"additionalFields": {
						SchemaProps: spec.SchemaProps{
							Description: "additionalFields is reserved for future use",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
			},
		},
		Dependencies: []string{
			"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.TeamstatusOperatorState"},
	}
}

func schema_pkg_apis_iam_v0alpha1_TeamstatusOperatorState(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastEvaluation": {
						SchemaProps: spec.SchemaProps{
							Description: "lastEvaluation is the ResourceVersion last evaluated",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"state": {
						SchemaProps: spec.SchemaProps{
							Description: "state describes the state of the lastEvaluation. It is limited to three possible states for machine evaluation.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"descriptiveState": {
						SchemaProps: spec.SchemaProps{
							Description: "descriptiveState is an optional more descriptive state field which has no requirements on format",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"details": {
						SchemaProps: spec.SchemaProps{
							Description: "details contains any extra information that is operator-specific",
							Type:        []string{"object"},
							AdditionalProperties: &spec.SchemaOrBool{
								Allows: true,
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Type:   []string{"object"},
										Format: "",
									},
								},
							},
						},
					},
				},
				Required: []string{"lastEvaluation", "state"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_User(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
						},
					},
					"spec": {
						SchemaProps: spec.SchemaProps{
							Description: "Spec is the spec of the User",
							Default:     map[string]interface{}{},
							Ref:         ref(iamv0alpha1.UserSpec{}.OpenAPIModelName()),
						},
					},
					"status": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref(iamv0alpha1.UserStatus{}.OpenAPIModelName()),
						},
					},
				},
				Required: []string{"metadata", "spec", "status"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.UserSpec{}.OpenAPIModelName(), iamv0alpha1.UserStatus{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_UserList(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"kind": {
						SchemaProps: spec.SchemaProps{
							Description: "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"apiVersion": {
						SchemaProps: spec.SchemaProps{
							Description: "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"metadata": {
						SchemaProps: spec.SchemaProps{
							Default: map[string]interface{}{},
							Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
						},
					},
					"items": {
						SchemaProps: spec.SchemaProps{
							Type: []string{"array"},
							Items: &spec.SchemaOrArray{
								Schema: &spec.Schema{
									SchemaProps: spec.SchemaProps{
										Default: map[string]interface{}{},
										Ref:     ref(iamv0alpha1.User{}.OpenAPIModelName()),
									},
								},
							},
						},
					},
				},
				Required: []string{"metadata", "items"},
			},
		},
		Dependencies: []string{
			iamv0alpha1.User{}.OpenAPIModelName(), "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"},
	}
}

func schema_pkg_apis_iam_v0alpha1_UserSpec(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"disabled": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"email": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"emailVerified": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"grafanaAdmin": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"login": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"title": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
					"provisioned": {
						SchemaProps: spec.SchemaProps{
							Default: false,
							Type:    []string{"boolean"},
							Format:  "",
						},
					},
					"role": {
						SchemaProps: spec.SchemaProps{
							Default: "",
							Type:    []string{"string"},
							Format:  "",
						},
					},
				},
				Required: []string{"disabled", "email", "emailVerified", "grafanaAdmin", "login", "title", "provisioned", "role"},
			},
		},
	}
}

func schema_pkg_apis_iam_v0alpha1_UserStatus(ref common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]spec.Schema{
					"lastSeenAt": {
						SchemaProps: spec.SchemaProps{
							Default: 0,
							Type:    []string{"integer"},
							Format:  "int64",
						},
					},
				},
				Required: []string{"lastSeenAt"},
			},
		},
	}
}

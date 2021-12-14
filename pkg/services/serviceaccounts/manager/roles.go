package manager

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

var (
	ActionApikeyList   = "apikey:list"
	ActionApikeyAdd    = "apikey:add"
	ActionApikeyRemove = "apikey:remove"
	apikeyAdminEdit    = "fixed:apikey:admin:edit"
	apikeyAdminRead    = "fixed:apikey:admin:read"

	//API key actions
	ActionApikeyListEv          accesscontrol.Evaluator
	ActionApikeyAddEv           accesscontrol.Evaluator
	ActionApikeyRemoveEv        accesscontrol.Evaluator
	ActionApikeyAddAdditionalEv accesscontrol.Evaluator
)

func InitPerms() {
	//API key actions
	ActionApikeyListEv = accesscontrol.EvalPermission("apikey:list")
	ActionApikeyAddEv = accesscontrol.EvalPermission("apikey:add")
	ActionApikeyRemoveEv = accesscontrol.EvalPermission("apikey:remove")
	ActionApikeyAddAdditionalEv = accesscontrol.EvalPermission("apikey:addadditional")
}

func RegisterRoles(ac accesscontrol.AccessControl) error {
	role := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     3,
			Name:        "fixed:serviceaccounts:writer",
			DisplayName: "Service accounts writer",
			Description: "Create, delete, read, or query service accounts.",
			Group:       "Service accounts",
			Permissions: []accesscontrol.Permission{
				{
					Action: serviceaccounts.ActionRead,
					Scope:  serviceaccounts.ScopeAll,
				},
				{
					Action: serviceaccounts.ActionCreate,
				},
				{
					Action: serviceaccounts.ActionDelete,
					Scope:  serviceaccounts.ScopeAll,
				},
			},
		},
		Grants: []string{"Admin"},
	}

	if err := ac.DeclareFixedRoles(role); err != nil {
		return err
	}

	apikeyAdminReadRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     1,
			Name:        apikeyAdminRead,
			Description: "Gives access to list apikeys.",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionApikeyList,
					Scope:  accesscontrol.ScopeUsersAll,
				},
			},
		},
		Grants: []string{"Admin"},
	}
	if err := ac.DeclareFixedRoles(apikeyAdminReadRole); err != nil {
		return err
	}

	apikeyAdminEditRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     1,
			Name:        apikeyAdminEdit,
			Description: "Gives access to add and delete api keys.",
			Permissions: accesscontrol.ConcatPermissions(apikeyAdminReadRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: ActionApikeyAdd,
					Scope:  accesscontrol.ScopeUsersAll,
				},
				{
					Action: ActionApikeyRemove,
					Scope:  accesscontrol.ScopeUsersAll,
				},
			}),
		},
		Grants: []string{"Admin"},
	}
	if err := ac.DeclareFixedRoles(apikeyAdminEditRole); err != nil {
		return err
	}

	InitPerms()
	return nil
}

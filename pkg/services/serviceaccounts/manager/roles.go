package manager

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

var (
	ActionApikeyList          = "apikey:list"
	ActionApikeyAdd           = "apikey:add"
	ActionApikeyRemove        = "apikey:remove"
	ActionApikeyAddAdditional = "apikey:addadditional"

	apikeyWriter = "fixed:apikey:writer"
	apikeyReader = "fixed:apikey:reader"

	//API key actions
	ActionApikeyListEv          = accesscontrol.EvalPermission(ActionApikeyList)
	ActionApikeyAddEv           = accesscontrol.EvalPermission(ActionApikeyAdd)
	ActionApikeyRemoveEv        = accesscontrol.EvalPermission(ActionApikeyRemove) //Improvement:Check here or in database layer that user has permissiono modify the service account attached to this api key
	ActionApikeyAddAdditionalEv = accesscontrol.EvalPermission(ActionApikeyAddAdditional)
)

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
			Name:        apikeyReader,
			DisplayName: "Apikeys reader",
			Description: "Gives access to list apikeys.",
			Group:       "Service accounts",
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
			Name:        apikeyWriter,
			DisplayName: "Apikeys writer",
			Description: "Gives access to add and delete api keys.",
			Group:       "Service accounts",
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

	return nil
}

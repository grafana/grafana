package ngalert

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
)

const AlertRolesGroup = "Alerting"

var (
	rulesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.rules:reader",
			DisplayName: "Rules Reader",
			Description: "Can read alert rules in all Grafana folders and external providers",
			Group:       AlertRolesGroup,
			Version:     2,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingRuleRead,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleExternalRead,
					Scope:  datasources.ScopeAll,
				},
			},
		},
	}

	rulesEditorRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.rules:editor",
			DisplayName: "Rules Editor",
			Description: "Can add, update, and delete rules in any Grafana folder and external providers",
			Group:       AlertRolesGroup,
			Version:     2,
			Permissions: accesscontrol.ConcatPermissions(rulesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingRuleCreate,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleUpdate,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleDelete,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleExternalWrite,
					Scope:  datasources.ScopeAll,
				},
			}),
		},
	}

	instancesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.instances:reader",
			DisplayName: "Instances and Silences Reader",
			Description: "Can read instances and silences of Grafana and external providers",
			Group:       AlertRolesGroup,
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingInstanceRead,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingInstancesExternalRead,
					Scope:  datasources.ScopeAll,
				},
			},
		},
	}

	instancesEditorRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.instances:editor",
			DisplayName: "Silences Editor",
			Description: "Can add and update silences in Grafana and external providers",
			Group:       AlertRolesGroup,
			Version:     1,
			Permissions: accesscontrol.ConcatPermissions(instancesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingInstanceCreate,
				},
				{
					Action: accesscontrol.ActionAlertingInstanceUpdate,
				},
				{
					Action: accesscontrol.ActionAlertingInstancesExternalWrite,
					Scope:  datasources.ScopeAll,
				},
			}),
		},
	}

	notificationsReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.notifications:reader",
			DisplayName: "Notifications Reader",
			Description: "Can read notification policies and contact points in Grafana and external providers",
			Group:       AlertRolesGroup,
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsRead,
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsExternalRead,
					Scope:  datasources.ScopeAll,
				},
			},
		},
	}

	notificationsEditorRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.notifications:editor",
			DisplayName: "Notifications Editor",
			Description: "Can add, update, and delete contact points and notification policies in Grafana and external providers",
			Group:       AlertRolesGroup,
			Version:     2,
			Permissions: accesscontrol.ConcatPermissions(notificationsReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsWrite,
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsExternalWrite,
					Scope:  datasources.ScopeAll,
				},
			}),
		},
	}

	alertingReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting:reader",
			DisplayName: "Full read-only access",
			Description: "Can read alert rules, instances, silences, contact points, and notification policies in Grafana and all external providers",
			Group:       AlertRolesGroup,
			Version:     2,
			Permissions: accesscontrol.ConcatPermissions(rulesReaderRole.Role.Permissions, instancesReaderRole.Role.Permissions, notificationsReaderRole.Role.Permissions),
		},
		Grants: []string{string(models.ROLE_VIEWER)},
	}

	alertingWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting:editor",
			DisplayName: "Full access",
			Description: "Can add,update and delete alert rules, instances, silences, contact points, and notification policies in Grafana and all external providers",
			Group:       AlertRolesGroup,
			Version:     3,
			Permissions: accesscontrol.ConcatPermissions(rulesEditorRole.Role.Permissions, instancesEditorRole.Role.Permissions, notificationsEditorRole.Role.Permissions),
		},
		Grants: []string{string(models.ROLE_EDITOR), string(models.ROLE_ADMIN)},
	}
)

func DeclareFixedRoles(ac accesscontrol.AccessControl) error {
	return ac.DeclareFixedRoles(
		rulesReaderRole, rulesEditorRole,
		instancesReaderRole, instancesEditorRole,
		notificationsReaderRole, notificationsEditorRole,
		alertingReaderRole, alertingWriterRole,
	)
}

package ngalert

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
)

const AlertRolesGroup = "Alerting"

var (
	rulesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.rules:reader",
			DisplayName: "Rules Reader",
			Description: "Read alert rules in all Grafana folders and external providers",
			Group:       AlertRolesGroup,
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

	rulesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.rules:writer",
			DisplayName: "Rules Writer",
			Description: "Add, update, and delete rules in any Grafana folder and external providers",
			Group:       AlertRolesGroup,
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
			Description: "Read instances and silences of Grafana and external providers",
			Group:       AlertRolesGroup,
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

	instancesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.instances:writer",
			DisplayName: "Silences Writer",
			Description: "Add and update silences in Grafana and external providers",
			Group:       AlertRolesGroup,
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
			Description: "Read notification policies and contact points in Grafana and external providers",
			Group:       AlertRolesGroup,
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

	notificationsWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.notifications:writer",
			DisplayName: "Notifications Writer",
			Description: "Add, update, and delete contact points and notification policies in Grafana and external providers",
			Group:       AlertRolesGroup,
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
			Description: "Read alert rules, instances, silences, contact points, and notification policies in Grafana and all external providers",
			Group:       AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(rulesReaderRole.Role.Permissions, instancesReaderRole.Role.Permissions, notificationsReaderRole.Role.Permissions),
		},
		Grants: []string{string(org.RoleViewer)},
	}

	alertingWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting:writer",
			DisplayName: "Full access",
			Description: "Add,update and delete alert rules, instances, silences, contact points, and notification policies in Grafana and all external providers",
			Group:       AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(rulesWriterRole.Role.Permissions, instancesWriterRole.Role.Permissions, notificationsWriterRole.Role.Permissions),
		},
		Grants: []string{string(org.RoleEditor), string(org.RoleAdmin)},
	}

	alertingProvisionerRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.provisioning:writer",
			DisplayName: "Access to alert rules provisioning API",
			Description: "Manage all alert rules, contact points, notification policies, silences, etc. in the organization via provisioning API.",
			Group:       AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingProvisioningRead, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingProvisioningWrite, // organization scope
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}
)

func DeclareFixedRoles(service accesscontrol.Service) error {
	return service.DeclareFixedRoles(
		rulesReaderRole, rulesWriterRole,
		instancesReaderRole, instancesWriterRole,
		notificationsReaderRole, notificationsWriterRole,
		alertingReaderRole, alertingWriterRole, alertingProvisionerRole,
	)
}

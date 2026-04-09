package accesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	rulesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.rules:reader",
			DisplayName: "Rules Reader",
			Description: "Read alert rules in all Grafana folders and external providers",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingRuleRead,
					Scope:  folder.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleExternalRead,
					Scope:  datasources.ScopeAll,
				},
				{
					Action: accesscontrol.ActionAlertingSilencesRead,
					Scope:  folder.ScopeFoldersAll,
				},
				// Following are needed for simplified notification policies
				{
					Action: accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
				},
				{
					Action: accesscontrol.ActionAlertingReceiversList,
				},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	rulesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.rules:writer",
			DisplayName: "Rules Writer",
			Description: "Add, update, and delete rules in any Grafana folder and external providers",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(rulesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingRuleCreate,
					Scope:  folder.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleUpdate,
					Scope:  folder.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleDelete,
					Scope:  folder.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleExternalWrite,
					Scope:  datasources.ScopeAll,
				},
				{
					Action: accesscontrol.ActionAlertingSilencesWrite,
					Scope:  folder.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingSilencesCreate,
					Scope:  folder.ScopeFoldersAll,
				},
			}),
		},
		Grants: []string{string(org.RoleEditor)},
	}

	instancesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.instances:reader",
			DisplayName: "Instances and Silences Reader",
			Description: "Read instances and silences of Grafana and external providers",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingInstanceRead,
				},
				{
					Action: accesscontrol.ActionAlertingInstancesExternalRead,
					Scope:  datasources.ScopeAll,
				},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	instancesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.instances:writer",
			DisplayName: "Silences Writer",
			Description: "Add and update silences in Grafana and external providers",
			Group:       models.AlertRolesGroup,
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
		Grants: []string{string(org.RoleEditor)},
	}

	receiversReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.receivers:reader",
			DisplayName: "Contact Point Reader",
			Description: "Read all contact points in Grafana",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingReceiversRead, Scope: models.ScopeReceiversAll},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	receiversCreatorRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.receivers:creator",
			DisplayName: "Contact Point Creator",
			Description: "Create new contact points in Grafana",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingReceiversCreate},
				{Action: accesscontrol.ActionAlertingReceiversTest}, // deprecated, kept for backward compatibility
				{Action: accesscontrol.ActionAlertingReceiversTestCreate, Scope: models.ScopeReceiversProvider.GetNewResourceScope()},
			},
		},
	}

	receiversWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.receivers:writer",
			DisplayName: "Contact Point Writer",
			Description: "Create, update, and delete all contact points in Grafana",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(receiversReaderRole.Role.Permissions, receiversCreatorRole.Role.Permissions, []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingReceiversUpdate, Scope: models.ScopeReceiversAll},
				{Action: accesscontrol.ActionAlertingReceiversDelete, Scope: models.ScopeReceiversAll},
				{Action: accesscontrol.ActionAlertingReceiversTestCreate, Scope: models.ScopeReceiversAll},
			}),
		},
		Grants: []string{string(org.RoleEditor)},
	}

	templatesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.templates:reader",
			DisplayName: "Templates Reader",
			Description: "Read all templates in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingNotificationsTemplatesRead},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	templatesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.templates:writer",
			DisplayName: "Templates Writer",
			Description: "Create, update, and delete all templates in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(templatesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingNotificationsTemplatesWrite},
				{Action: accesscontrol.ActionAlertingNotificationsTemplatesDelete},
				{Action: accesscontrol.ActionAlertingNotificationsTemplatesTest},
			}),
		},
		Grants: []string{string(org.RoleEditor)},
	}

	timeIntervalsReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.time-intervals:reader",
			DisplayName: "Time Intervals Reader",
			Description: "Read all time intervals in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingNotificationsTimeIntervalsRead},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	timeIntervalsWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.time-intervals:writer",
			DisplayName: "Time Intervals Writer",
			Description: "Create, update, and delete all time intervals in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(timeIntervalsReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite},
				{Action: accesscontrol.ActionAlertingNotificationsTimeIntervalsDelete},
			}),
		},
		Grants: []string{string(org.RoleEditor)},
	}

	routesCreatorRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.managed-routes:creator",
			DisplayName: "Notification Policies Creator",
			Description: "Create notification policies in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingManagedRoutesCreate},
			},
		},
		Grants: []string{string(org.RoleEditor)},
	}

	routesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.routes:reader",
			DisplayName: "Notification Policies Reader",
			Description: "Read all notification policies in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions([]accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll},
			}),
		},
		Grants: []string{string(org.RoleAdmin)}, // Read permissions are granted to Editor as a managed role
	}

	routesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.routes:writer",
			DisplayName: "Notification Policies Writer",
			Description: "Create, update and delete notification policies in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(routesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingManagedRoutesCreate},
				{Action: accesscontrol.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesAll},
				{Action: accesscontrol.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesAll},
			}),
		},
		Grants: []string{string(org.RoleAdmin)}, // Write permissions are granted to Editor as a managed role
	}

	inhibitionRulesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.inhibition-rules:reader",
			DisplayName: "Inhibition Rules Reader",
			Description: "Read all inhibition rules in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingNotificationsInhibitionRulesRead, Scope: models.ScopeInhibitionRulesAll},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}

	inhibitionRulesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.inhibition-rules:writer",
			DisplayName: "Inhibition Rules Writer",
			Description: "Create, update, and delete all inhibition rules in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(inhibitionRulesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingNotificationsInhibitionRulesWrite, Scope: models.ScopeInhibitionRulesAll},
				{Action: accesscontrol.ActionAlertingNotificationsInhibitionRulesDelete, Scope: models.ScopeInhibitionRulesAll},
			}),
		},
		Grants: []string{string(org.RoleEditor)},
	}

	notificationsReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.notifications:reader",
			DisplayName: "Notifications Reader",
			Description: "Read notification policies and contact points in Grafana and external providers",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(
				receiversReaderRole.Role.Permissions,
				templatesReaderRole.Role.Permissions,
				timeIntervalsReaderRole.Role.Permissions,
				routesReaderRole.Role.Permissions,
				inhibitionRulesReaderRole.Role.Permissions,
				externalNotificationsReaderRole.Role.Permissions,
			),
		},
	}

	notificationsWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.notifications:writer",
			DisplayName: "Notifications Writer",
			Description: "Add, update, and delete contact points and notification policies in Grafana and external providers",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(
				notificationsReaderRole.Role.Permissions,
				receiversWriterRole.Role.Permissions,
				templatesWriterRole.Role.Permissions,
				timeIntervalsWriterRole.Role.Permissions,
				routesWriterRole.Role.Permissions,
				inhibitionRulesWriterRole.Role.Permissions,
				externalNotificationsWriterRole.Role.Permissions,
			),
		},
	}

	alertingReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting:reader",
			DisplayName: "Full read-only access",
			Description: "Read alert rules, instances, silences, contact points, and notification policies in Grafana and all external providers",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(rulesReaderRole.Role.Permissions, instancesReaderRole.Role.Permissions, notificationsReaderRole.Role.Permissions),
		},
	}

	alertingWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting:writer",
			DisplayName: "Full write access",
			Description: "Add, update and delete alert rules, instances, silences, contact points, and notification policies in Grafana and all external providers",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(rulesWriterRole.Role.Permissions, instancesWriterRole.Role.Permissions, notificationsWriterRole.Role.Permissions),
		},
	}

	alertingAdminRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting:admin",
			DisplayName: "Full admin access",
			Description: "Full write access in Grafana and all external providers, including their permissions, protected fields and secrets",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(alertingWriterRole.Role.Permissions, []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingReceiversPermissionsRead, Scope: models.ScopeReceiversAll},
				{Action: accesscontrol.ActionAlertingReceiversPermissionsWrite, Scope: models.ScopeReceiversAll},
				{Action: accesscontrol.ActionAlertingReceiversReadSecrets, Scope: models.ScopeReceiversAll},
				{Action: accesscontrol.ActionAlertingReceiversUpdateProtected, Scope: models.ScopeReceiversAll},
				{Action: accesscontrol.ActionAlertingNotificationSystemStatus},
				{Action: accesscontrol.ActionAlertingRoutesPermissionsRead, Scope: models.ScopeRoutesAll},
				{Action: accesscontrol.ActionAlertingRoutesPermissionsWrite, Scope: models.ScopeRoutesAll},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	alertingProvisionerRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.provisioning:writer",
			DisplayName: "Write via Provisioning API",
			Description: "Manage all alert rules, contact points, notification policies, silences, etc. in the organization via provisioning API.",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingProvisioningRead, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingProvisioningWrite, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingRulesProvisioningRead, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingRulesProvisioningWrite, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsProvisioningRead, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsProvisioningWrite, // organization scope
				},
				{
					Action: folder.ActionFoldersRead,
					Scope:  folder.ScopeFoldersAll,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	alertingProvisioningReaderWithSecretsRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.provisioning.secrets:reader",
			DisplayName: "Read via Provisioning API + Export Secrets",
			Description: "Read all alert rules, contact points, notification policies, silences, etc. in the organization via provisioning API and use export with decrypted secrets",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingProvisioningReadSecrets, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingProvisioningRead, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingRulesProvisioningRead, // organization scope
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsProvisioningRead, // organization scope
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	alertingProvisioningStatus = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.provisioning.provenance:writer",
			DisplayName: "Set provisioning status",
			Description: "Set provisioning status for alerting resources. Should be used together with other regular roles (Notifications Writer and/or Rules Writer)",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingProvisioningSetStatus, // organization scope
				},
			},
		},
		Grants: []string{string(org.RoleAdmin), string(org.RoleEditor)},
	}
	externalNotificationsReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.notifications.external:reader",
			DisplayName: "External Notifications Reader",
			Description: "Read notification policies and contact points in external providers",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions([]accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsExternalRead,
					Scope:  datasources.ScopeAll,
				},
			}),
		},
		Grants: []string{string(org.RoleViewer)},
	}

	externalNotificationsWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.notifications.external:writer",
			DisplayName: "External Notifications Writer",
			Description: "Add, update, and delete contact points and notification policies in external providers",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(externalNotificationsReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsExternalWrite,
					Scope:  datasources.ScopeAll,
				},
			}),
		},
		Grants: []string{string(org.RoleEditor)},
	}

	// deprecatedActionsRole contains deprecated actions just to keep the actions in the registry. The actions are granted to Admin just to make sure we do not accidentally completely lose access to an API or feature that happen to use only legacy
	deprecatedActionsRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.legacy:writer",
			Hidden:      true,
			DisplayName: "Alerting legacy permissions (deprecated, admin only)",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsConfigHistoryRead,
				},
				{
					Action: accesscontrol.ActionAlertingRoutesRead,
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsRead,
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsConfigHistoryWrite,
				},
				{
					Action: accesscontrol.ActionAlertingRoutesWrite,
				},
				{
					Action: accesscontrol.ActionAlertingNotificationsWrite,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}
)

func DeclareFixedRoles(service accesscontrol.Service, features featuremgmt.FeatureToggles) error {
	fixedRoles := []accesscontrol.RoleRegistration{
		rulesReaderRole, rulesWriterRole,
		instancesReaderRole, instancesWriterRole,
		notificationsReaderRole, notificationsWriterRole,
		alertingReaderRole, alertingWriterRole, alertingAdminRole, alertingProvisionerRole, alertingProvisioningReaderWithSecretsRole, alertingProvisioningStatus,
		externalNotificationsReaderRole, externalNotificationsWriterRole, deprecatedActionsRole,
		// k8s roles
		receiversReaderRole, receiversCreatorRole, receiversWriterRole,
		templatesReaderRole, templatesWriterRole,
		timeIntervalsReaderRole, timeIntervalsWriterRole,
		routesCreatorRole, routesReaderRole, routesWriterRole,
		inhibitionRulesReaderRole, inhibitionRulesWriterRole,
	}

	return service.DeclareFixedRoles(fixedRoles...)
}

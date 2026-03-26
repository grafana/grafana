package accesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingRuleExternalRead,
					Scope:  datasources.ScopeAll,
				},
				{
					Action: accesscontrol.ActionAlertingSilencesRead,
					Scope:  dashboards.ScopeFoldersAll,
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
				{
					Action: accesscontrol.ActionAlertingSilencesWrite,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: accesscontrol.ActionAlertingSilencesCreate,
					Scope:  dashboards.ScopeFoldersAll,
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

	routesReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.routes:reader",
			DisplayName: "Notification Policies Reader",
			Description: "Read all notification policies in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions([]accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingRoutesRead},
			}),
		},
		Grants: []string{string(org.RoleViewer)},
	}

	routesWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.routes:writer",
			DisplayName: "Notification Policies Writer",
			Description: "Update and reset notification policies in Grafana alerting",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(routesReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingRoutesWrite},
			}),
		},
		Grants: []string{string(org.RoleEditor)},
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
				[]accesscontrol.Permission{
					{
						Action: accesscontrol.ActionAlertingNotificationsRead, // TODO remove when we decide tò limit access to raw config API
					},
				}),
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
				[]accesscontrol.Permission{
					{
						Action: accesscontrol.ActionAlertingNotificationsWrite, // TODO remove when we decide tò limit access to raw config API
					},
				}),
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
					Action: dashboards.ActionFoldersRead,
					Scope:  dashboards.ScopeFoldersAll,
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

	// Add legacy permissions that we keep for backward compatibility but do not want in the fixed roles.
	legacyReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.legacy:reader",
			Hidden:      true,
			DisplayName: "Alerting legacy read permissions (DO NOT USE)",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsRead,
				},
			},
		},
		Grants: []string{string(org.RoleViewer)}, // TODO remove when we decide tò limit access to raw config API
	}

	// Add legacy permissions that we keep for backward compatibility but do not want in the fixed roles.
	legacyWriteRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.legacy:writer",
			Hidden:      true,
			DisplayName: "Alerting legacy write permissions (DO NOT USE)",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(legacyReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsWrite,
				},
			}),
		},
		Grants: []string{string(org.RoleEditor)}, // TODO remove when we decide tò limit access to raw config API
	}

	// legacyAdminReaderRole grants read access to the raw Alertmanager config endpoints:
	// GET /config/api/v1/alerts and GET /config/history. Admin-only in v13; removed in v14.
	// Deprecated: do not use this role in new code, it is only kept for backward compatibility and will be removed in a
	// future release.
	legacyAdminReaderRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.legacy.config:reader",
			Hidden:      true,
			DisplayName: "Alerting legacy config read permission (deprecated, admin only)",
			Group:       models.AlertRolesGroup,
			Permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsConfigHistoryRead,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	// legacyAdminWriterRole grants write access to the raw Alertmanager config history endpoint:
	// POST /config/history/{id}/_activate. Admin-only in v13; removed in v14.
	// Deprecated: do not use this role in new code, it is only kept for backward compatibility and will be removed in a
	// future release.
	legacyAdminWriterRole = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "alerting.legacy.config:writer",
			Hidden:      true,
			DisplayName: "Alerting legacy config write permission (deprecated, admin only)",
			Group:       models.AlertRolesGroup,
			Permissions: accesscontrol.ConcatPermissions(legacyAdminReaderRole.Role.Permissions, []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionAlertingNotificationsConfigHistoryWrite,
				},
			}),
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
		externalNotificationsReaderRole, externalNotificationsWriterRole, legacyReaderRole, legacyWriteRole, legacyAdminReaderRole, legacyAdminWriterRole,
		// k8s roles
		receiversReaderRole, receiversCreatorRole, receiversWriterRole, templatesReaderRole, templatesWriterRole,
		timeIntervalsReaderRole, timeIntervalsWriterRole, routesReaderRole, routesWriterRole, inhibitionRulesReaderRole, inhibitionRulesWriterRole,
	}

	return service.DeclareFixedRoles(fixedRoles...)
}

import { useMemo } from 'react';

import { OrgRole } from '@grafana/data';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { getInstancesPermissions, getNotificationsPermissions } from '../utils/access-control';

/**
 * These hooks will determine if
 *  1. the action is supported in the current alertmanager or data source context
 *  2. user is allowed to perform actions based on their set of permissions / assigned role
 */
export enum AlertmanagerAction {
  // configuration
  ViewExternalConfiguration = 'View-external-configuration',
  UpdateExternalConfiguration = 'update-external-configuration',

  // contact points
  CreateContactPoint = 'create-contact-point',
  ViewContactPoint = 'view-contact-point',
  UpdateContactPoint = 'edit-contact-points',
  DeleteContactPoint = 'delete-contact-point',
  ExportContactPoint = 'export-contact-point',

  // notification templates
  CreateNotificationTemplate = 'create-notification-template',
  ViewNotificationTemplate = 'view-notification-template',
  UpdateNotificationTemplate = 'edit-notification-template',
  DeleteNotificationTemplate = 'delete-notification-template',

  // notification policies
  ViewNotificationPolicyTree = 'view-notification-policy-tree',
  UpdateNotificationPolicyTree = 'update-notification-policy-tree',

  // silences – these cannot be deleted only "expired" (updated)
  CreateSilence = 'create-silence',
  ViewSilence = 'view-silence',
  UpdateSilence = 'update-silence',

  // mute timings
  ViewMuteTiming = 'view-mute-timing',
  CreateMuteTiming = 'create-mute-timing',
  UpdateMuteTiming = 'update-mute-timing',
  DeleteMuteTiming = 'delete-mute-timing',
}

export enum AlertSourceAction {
  // internal (Grafana managed)
  CreateAlertRule = 'create-alert-rule',
  ViewAlertRule = 'view-alert-rule',
  UpdateAlertRule = 'update-alert-rule',
  DeleteAlertRule = 'delete-alert-rule',
  // external (any compatible alerting data source)
  CreateExternalAlertRule = 'create-external-alert-rule',
  ViewExternalAlertRule = 'view-external-alert-rule',
  UpdateExternalAlertRule = 'update-external-alert-rule',
  DeleteExternalAlertRule = 'delete-external-alert-rule',
}

export type Action = AlertmanagerAction | AlertSourceAction;

export type Ability = [actionSupported: boolean, actionPermitted: boolean];
export type Abilities<T extends Action> = Record<T, Ability>;

export function useAlertSourceAbilities(): Abilities<AlertSourceAction> {
  // TODO add the "supported" booleans here, we currently only do authorization

  const abilities: Abilities<AlertSourceAction> = {
    // -- Grafana managed alert rules --
    [AlertSourceAction.CreateAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleCreate, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertSourceAction.ViewAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleRead, ctx.hasRole(OrgRole.Viewer)),
    ],
    [AlertSourceAction.UpdateAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleUpdate, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertSourceAction.DeleteAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleDelete, ctx.hasRole(OrgRole.Editor)),
    ],
    // -- External alert rules (Mimir / Loki / etc) --
    // for these we only have "read" and "write" permissions
    [AlertSourceAction.CreateExternalAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleExternalWrite, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertSourceAction.ViewExternalAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleExternalRead, ctx.hasRole(OrgRole.Viewer)),
    ],
    [AlertSourceAction.UpdateExternalAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleExternalWrite, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertSourceAction.DeleteExternalAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleExternalWrite, ctx.hasRole(OrgRole.Editor)),
    ],
  };

  return abilities;
}

export function useAlertmanagerAbilities(): Abilities<AlertmanagerAction> {
  const { selectedAlertmanager, hasConfigurationAPI, isGrafanaFlavoredAlertmanager } = useAlertmanager();

  // These are used for interacting with Alertmanager resources where we apply alert.notifications:<name> permissions.
  // There are different permissions based on wether the built-in alertmanager is selected (grafana) or an external one.
  const notificationsPermissions = getNotificationsPermissions(selectedAlertmanager!);
  const instancePermissions = getInstancesPermissions(selectedAlertmanager!);

  // list out all of the abilities, and if the user has permissions to perform them
  const abilities: Abilities<AlertmanagerAction> = {
    // -- configuration --
    [AlertmanagerAction.ViewExternalConfiguration]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingNotificationsExternalRead, ctx.hasRole(OrgRole.Admin)),
    ],
    [AlertmanagerAction.UpdateExternalConfiguration]: [
      hasConfigurationAPI,
      ctx.hasAccess(AccessControlAction.AlertingNotificationsExternalWrite, ctx.hasRole(OrgRole.Admin)),
    ],
    // -- contact points --
    [AlertmanagerAction.CreateContactPoint]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.create, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.ViewContactPoint]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.read, ctx.hasRole(OrgRole.Viewer)),
    ],
    [AlertmanagerAction.UpdateContactPoint]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.update, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.DeleteContactPoint]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.delete, ctx.hasRole(OrgRole.Admin)),
    ],
    // only Grafana flavored alertmanager supports exporting
    [AlertmanagerAction.ExportContactPoint]: [
      isGrafanaFlavoredAlertmanager,
      ctx.hasAccess(notificationsPermissions.provisioning.read, ctx.hasRole(OrgRole.Admin)) ||
        ctx.hasAccess(notificationsPermissions.provisioning.readSecrets, ctx.hasRole(OrgRole.Admin)),
    ],
    // -- notification templates --
    [AlertmanagerAction.CreateNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.create, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.ViewNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.read, ctx.hasRole(OrgRole.Viewer)),
    ],
    [AlertmanagerAction.UpdateNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.update, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.DeleteNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.delete, ctx.hasRole(OrgRole.Admin)),
    ],
    // -- notification policies --
    [AlertmanagerAction.UpdateNotificationPolicyTree]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.update, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.ViewNotificationPolicyTree]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.read, ctx.hasRole(OrgRole.Viewer)),
    ],
    // -- silences --
    [AlertmanagerAction.CreateSilence]: [
      hasConfigurationAPI,
      ctx.hasAccess(instancePermissions.create, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.ViewSilence]: [
      hasConfigurationAPI,
      ctx.hasAccess(instancePermissions.read, ctx.hasRole(OrgRole.Viewer)),
    ],
    [AlertmanagerAction.UpdateSilence]: [
      hasConfigurationAPI,
      ctx.hasAccess(instancePermissions.update, ctx.hasRole(OrgRole.Editor)),
    ],
    // -- mute timtings --
    [AlertmanagerAction.CreateMuteTiming]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.create, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.UpdateMuteTiming]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.update, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.DeleteMuteTiming]: [
      hasConfigurationAPI,
      ctx.hasAccess(notificationsPermissions.delete, ctx.hasRole(OrgRole.Editor)),
    ],
    [AlertmanagerAction.ViewMuteTiming]: [
      true,
      ctx.hasAccess(notificationsPermissions.read, ctx.hasRole(OrgRole.Viewer)),
    ],
  };

  return abilities;
}

export function useAlertmanagerAbility(action: AlertmanagerAction): Ability {
  const abilities = useAlertmanagerAbilities();
  return useMemo(() => abilities[action], [abilities, action]);
}

export function useAlertSourceAbility(action: AlertSourceAction): Ability {
  const abilities = useAlertSourceAbilities();
  return useMemo(() => abilities[action], [abilities, action]);
}

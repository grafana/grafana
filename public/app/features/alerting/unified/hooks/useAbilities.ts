import { useMemo } from 'react';

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
  ViewExternalConfiguration = 'view-external-configuration',
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
  CreateNotificationPolicy = 'create-notification-policy',
  ViewNotificationPolicyTree = 'view-notification-policy-tree',
  UpdateNotificationPolicyTree = 'update-notification-policy-tree',
  DeleteNotificationPolicy = 'delete-notification-policy',

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
    [AlertSourceAction.CreateAlertRule]: [true, ctx.hasPermission(AccessControlAction.AlertingRuleCreate)],
    [AlertSourceAction.ViewAlertRule]: [true, ctx.hasPermission(AccessControlAction.AlertingRuleRead)],
    [AlertSourceAction.UpdateAlertRule]: [true, ctx.hasPermission(AccessControlAction.AlertingRuleUpdate)],
    [AlertSourceAction.DeleteAlertRule]: [true, ctx.hasPermission(AccessControlAction.AlertingRuleDelete)],
    // -- External alert rules (Mimir / Loki / etc) --
    // for these we only have "read" and "write" permissions
    [AlertSourceAction.CreateExternalAlertRule]: [
      true,
      ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
    ],
    [AlertSourceAction.ViewExternalAlertRule]: [true, ctx.hasPermission(AccessControlAction.AlertingRuleExternalRead)],
    [AlertSourceAction.UpdateExternalAlertRule]: [
      true,
      ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
    ],
    [AlertSourceAction.DeleteExternalAlertRule]: [
      true,
      ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
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
      ctx.hasPermission(AccessControlAction.AlertingNotificationsExternalRead),
    ],
    [AlertmanagerAction.UpdateExternalConfiguration]: [
      hasConfigurationAPI,
      ctx.hasPermission(AccessControlAction.AlertingNotificationsExternalWrite),
    ],
    // -- contact points --
    [AlertmanagerAction.CreateContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.create)],
    [AlertmanagerAction.ViewContactPoint]: [true, ctx.hasPermission(notificationsPermissions.read)],
    [AlertmanagerAction.UpdateContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.update)],
    [AlertmanagerAction.DeleteContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.delete)],
    // only Grafana flavored alertmanager supports exporting
    [AlertmanagerAction.ExportContactPoint]: [
      isGrafanaFlavoredAlertmanager,
      ctx.hasPermission(notificationsPermissions.provisioning.read) ||
        ctx.hasPermission(notificationsPermissions.provisioning.readSecrets),
    ],
    // -- notification templates --
    [AlertmanagerAction.CreateNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.create),
    ],
    [AlertmanagerAction.ViewNotificationTemplate]: [true, ctx.hasPermission(notificationsPermissions.read)],
    [AlertmanagerAction.UpdateNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.update),
    ],
    [AlertmanagerAction.DeleteNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.delete),
    ],
    // -- notification policies --
    [AlertmanagerAction.CreateNotificationPolicy]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.create),
    ],
    [AlertmanagerAction.ViewNotificationPolicyTree]: [true, ctx.hasPermission(notificationsPermissions.read)],
    [AlertmanagerAction.UpdateNotificationPolicyTree]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.update),
    ],
    [AlertmanagerAction.DeleteNotificationPolicy]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.delete),
    ],
    // -- silences --
    [AlertmanagerAction.CreateSilence]: [hasConfigurationAPI, ctx.hasPermission(instancePermissions.create)],
    [AlertmanagerAction.ViewSilence]: [true, ctx.hasPermission(instancePermissions.read)],
    [AlertmanagerAction.UpdateSilence]: [hasConfigurationAPI, ctx.hasPermission(instancePermissions.update)],
    // -- mute timtings --
    [AlertmanagerAction.CreateMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.create)],
    [AlertmanagerAction.ViewMuteTiming]: [true, ctx.hasPermission(notificationsPermissions.read)],
    [AlertmanagerAction.UpdateMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.update)],
    [AlertmanagerAction.DeleteMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.delete)],
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

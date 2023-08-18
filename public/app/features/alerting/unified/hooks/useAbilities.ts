import { useMemo } from 'react';

import { OrgRole } from '@grafana/data';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { getInstancesPermissions, getNotificationsPermissions } from '../utils/access-control';
import { GRAFANA_DATASOURCE_NAME } from '../utils/datasource';

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

  // silences
  CreateSilence = 'create-silence',
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
  // external (any compatible alerting data source)
  CreateExternalAlertRule = 'create-external-alert-rule',
  ViewExternalAlertRule = 'view-external-alert-rule',
}

export type Action = AlertmanagerAction | AlertSourceAction;

export type Ability = [actionSupported: boolean, actionPermitted: boolean];
export type Abilities<T extends Action> = Record<T, Ability>;

const RULER_ENABLED_ALERTMANAGER_FLAVORS = [AlertManagerImplementation.mimir, AlertManagerImplementation.cortex];

export function useAlertSourceAbilities(): Abilities<AlertSourceAction> {
  // TODO some sort of memoization per datasource?

  return {
    [AlertSourceAction.CreateAlertRule]: [true, true], // TODO
    [AlertSourceAction.ViewAlertRule]: [true, ctx.hasAccess(AccessControlAction.AlertingRuleRead, true)],
    [AlertSourceAction.CreateExternalAlertRule]: [true, true], // TODO
    [AlertSourceAction.ViewExternalAlertRule]: [
      true,
      ctx.hasAccess(AccessControlAction.AlertingRuleExternalRead, true),
    ],
  };
}

/**
 * This hook will determine if
 *  1. action is supported in the current alertmanager context
 *  2. user is allowed to perform actions based on their set of permissions / assigned role
 */
export function useAlertmanagerAbilities(): Abilities<AlertmanagerAction> {
  const { selectedAlertmanager, selectedAlertmanagerConfig } = useAlertmanager();

  // determine if we're dealing with an Alertmanager data source that supports the ruler API
  const isGrafanaFlavoredAlertmanager = selectedAlertmanager === GRAFANA_DATASOURCE_NAME;
  const isRulerFlavoredAlertmanager = RULER_ENABLED_ALERTMANAGER_FLAVORS.includes(
    selectedAlertmanagerConfig?.implementation!
  );

  const hasConfigurationAPI = isGrafanaFlavoredAlertmanager || isRulerFlavoredAlertmanager;

  // These are used for interacting with Alertmanager resources where we apply alert.notifications:<name> permissions.
  // There are different permissions based on wether the built-in alertmanager is selected (grafana) or an external one.
  const notificationsPermissions = getNotificationsPermissions(selectedAlertmanager!);
  const instancePermissions = getInstancesPermissions(selectedAlertmanager!);

  // list out all of the abilities, and if the user has permissions to perform them
  const abilities: Abilities<AlertmanagerAction> = {
    // -- configuration --
    [AlertmanagerAction.ViewExternalConfiguration]: [
      true, // all alertmanager flavours support reading / viewing the configuration
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
    // -- silences --
    [AlertmanagerAction.CreateSilence]: [
      hasConfigurationAPI,
      ctx.hasAccess(instancePermissions.create, ctx.hasRole(OrgRole.Editor)),
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

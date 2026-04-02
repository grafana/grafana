import { useMemo } from 'react';

import { contextSrv as ctx } from 'app/core/services/context_srv';
import { PERMISSIONS_CONTACT_POINTS_READ } from 'app/features/alerting/unified/components/contact-points/permissions';
import {
  PERMISSIONS_TIME_INTERVALS_MODIFY,
  PERMISSIONS_TIME_INTERVALS_READ,
} from 'app/features/alerting/unified/components/mute-timings/permissions';
import {
  PERMISSIONS_NOTIFICATION_POLICIES_MODIFY,
  PERMISSIONS_NOTIFICATION_POLICIES_READ,
} from 'app/features/alerting/unified/components/notification-policies/permissions';
import { AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { getInstancesPermissions, getNotificationsPermissions } from '../utils/access-control';
import { isAdmin } from '../utils/misc';

import { type Abilities, type Ability, AlertmanagerAction, ExternalAlertmanagerAction } from './useAbilities.types';

// these just makes it easier to read the code :)
const AlwaysSupported = true;

export function useAllAlertmanagerAbilities(): Abilities<AlertmanagerAction> {
  const {
    selectedAlertmanager,
    hasConfigurationAPI,
    isGrafanaAlertmanager: isGrafanaFlavoredAlertmanager,
  } = useAlertmanager();

  // These are used for interacting with Alertmanager resources where we apply alert.notifications:<name> permissions.
  // There are different permissions based on whether the built-in alertmanager is selected (grafana) or an external one.
  const notificationsPermissions = getNotificationsPermissions(selectedAlertmanager!);
  const instancePermissions = getInstancesPermissions(selectedAlertmanager!);

  const abilities: Abilities<AlertmanagerAction> = {
    // -- contact points --
    [AlertmanagerAction.CreateContactPoint]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.create,
      // TODO: Move this into the permissions config and generalise that code to allow for an array of permissions
      ...(isGrafanaFlavoredAlertmanager ? [AccessControlAction.AlertingReceiversCreate] : [])
    ),
    [AlertmanagerAction.ViewContactPoint]: toAbility(
      AlwaysSupported,
      notificationsPermissions.read,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_CONTACT_POINTS_READ : [])
    ),
    [AlertmanagerAction.UpdateContactPoint]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.update,
      ...(isGrafanaFlavoredAlertmanager ? [AccessControlAction.AlertingReceiversWrite] : [])
    ),
    [AlertmanagerAction.DeleteContactPoint]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.delete,
      ...(isGrafanaFlavoredAlertmanager ? [AccessControlAction.AlertingReceiversWrite] : [])
    ),
    // At the time of writing, only Grafana flavored alertmanager supports exporting,
    // and if a user can view the contact point, then they can also export it
    // So the only check we make is if the alertmanager is Grafana flavored
    [AlertmanagerAction.ExportContactPoint]: [isGrafanaFlavoredAlertmanager, isGrafanaFlavoredAlertmanager],
    // -- notification templates --
    [AlertmanagerAction.CreateNotificationTemplate]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.create,
      ...(isGrafanaFlavoredAlertmanager ? [AccessControlAction.AlertingTemplatesWrite] : [])
    ),
    [AlertmanagerAction.ViewNotificationTemplate]: toAbility(
      AlwaysSupported,
      notificationsPermissions.read,
      ...(isGrafanaFlavoredAlertmanager ? [AccessControlAction.AlertingTemplatesRead] : [])
    ),
    [AlertmanagerAction.UpdateNotificationTemplate]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.update,
      ...(isGrafanaFlavoredAlertmanager ? [AccessControlAction.AlertingTemplatesWrite] : [])
    ),
    [AlertmanagerAction.DeleteNotificationTemplate]: toAbility(hasConfigurationAPI, notificationsPermissions.delete),
    // -- notification policies --
    [AlertmanagerAction.CreateNotificationPolicy]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.create,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_NOTIFICATION_POLICIES_MODIFY : [])
    ),
    [AlertmanagerAction.ViewNotificationPolicyTree]: toAbility(
      AlwaysSupported,
      notificationsPermissions.read,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_NOTIFICATION_POLICIES_READ : [])
    ),
    [AlertmanagerAction.UpdateNotificationPolicyTree]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.update,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_NOTIFICATION_POLICIES_MODIFY : [])
    ),
    [AlertmanagerAction.DeleteNotificationPolicy]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.delete,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_NOTIFICATION_POLICIES_MODIFY : [])
    ),
    [AlertmanagerAction.ExportNotificationPolicies]: toAbility(
      isGrafanaFlavoredAlertmanager,
      notificationsPermissions.read
    ),
    [AlertmanagerAction.DecryptSecrets]: toAbility(
      isGrafanaFlavoredAlertmanager,
      notificationsPermissions.provisioning.readSecrets
    ),
    [AlertmanagerAction.ViewAutogeneratedPolicyTree]: [isGrafanaFlavoredAlertmanager, isAdmin()],
    // -- silences --
    // for now, all supported Alertmanager flavors have API endpoints for managing silences
    [AlertmanagerAction.CreateSilence]: toAbility(AlwaysSupported, instancePermissions.create),
    [AlertmanagerAction.ViewSilence]: toAbility(AlwaysSupported, instancePermissions.read),
    [AlertmanagerAction.UpdateSilence]: toAbility(AlwaysSupported, instancePermissions.update),
    [AlertmanagerAction.PreviewSilencedInstances]: toAbility(AlwaysSupported, instancePermissions.read),
    // -- time intervals --
    [AlertmanagerAction.CreateTimeInterval]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.create,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_TIME_INTERVALS_MODIFY : [])
    ),
    [AlertmanagerAction.ViewTimeInterval]: toAbility(
      AlwaysSupported,
      notificationsPermissions.read,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_TIME_INTERVALS_READ : [])
    ),
    [AlertmanagerAction.UpdateTimeInterval]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.update,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_TIME_INTERVALS_MODIFY : [])
    ),
    [AlertmanagerAction.DeleteTimeInterval]: toAbility(
      hasConfigurationAPI,
      notificationsPermissions.delete,
      ...(isGrafanaFlavoredAlertmanager ? PERMISSIONS_TIME_INTERVALS_MODIFY : [])
    ),
    [AlertmanagerAction.ExportTimeIntervals]: toAbility(isGrafanaFlavoredAlertmanager, notificationsPermissions.read),
    [AlertmanagerAction.ViewAlertGroups]: toAbility(AlwaysSupported, instancePermissions.read),
  };

  return abilities;
}

export function useAlertmanagerAbility(action: AlertmanagerAction): Ability {
  const abilities = useAllAlertmanagerAbilities();
  return useMemo(() => abilities[action], [abilities, action]);
}

export function useAlertmanagerAbilities(actions: AlertmanagerAction[]): Ability[] {
  const abilities = useAllAlertmanagerAbilities();
  return useMemo(() => actions.map((action) => abilities[action]), [abilities, actions]);
}

export function useAllExternalAlertmanagerAbilities(): Abilities<ExternalAlertmanagerAction> {
  const { hasConfigurationAPI } = useAlertmanager();

  return {
    [ExternalAlertmanagerAction.ViewExternalConfiguration]: toAbility(
      AlwaysSupported,
      AccessControlAction.AlertingNotificationsExternalRead
    ),
    [ExternalAlertmanagerAction.UpdateExternalConfiguration]: toAbility(
      hasConfigurationAPI,
      AccessControlAction.AlertingNotificationsExternalWrite
    ),
  };
}

export function useExternalAlertmanagerAbility(action: ExternalAlertmanagerAction): Ability {
  const abilities = useAllExternalAlertmanagerAbilities();
  return useMemo(() => abilities[action], [abilities, action]);
}

// just a convenient function
const toAbility = (
  supported: boolean,
  /** If user has any of these permissions, then they are allowed to perform the action */
  ...actions: AccessControlAction[]
): Ability => [supported, actions.some((action) => action && ctx.hasPermission(action))];

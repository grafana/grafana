import { useMemo } from 'react';

import { AccessControlAction } from 'app/types/accessControl';

import { type NotificationTemplate } from '../../../components/contact-points/useNotificationTemplates';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { notificationsPermissions } from '../../../utils/access-control';
import { isProvisionedResource } from '../../../utils/k8s/utils';
import { makeAbility } from '../abilityUtils';
import { type Ability, NotSupported, NotificationTemplateAction, Provisioned } from '../types';

export type NotificationTemplateAbilityParam =
  | { action: NotificationTemplateAction.View }
  | { action: NotificationTemplateAction.Create }
  | { action: NotificationTemplateAction.Update; context?: NotificationTemplate }
  | { action: NotificationTemplateAction.Delete; context?: NotificationTemplate }
  | { action: NotificationTemplateAction.Test; context?: NotificationTemplate };

/** Permissions for the Grafana-managed alertmanager (internal k8s API). */
const PERMISSIONS: Record<NotificationTemplateAction, AccessControlAction[]> = {
  [NotificationTemplateAction.View]: [notificationsPermissions.read.grafana, AccessControlAction.AlertingTemplatesRead],
  [NotificationTemplateAction.Create]: [
    notificationsPermissions.create.grafana,
    AccessControlAction.AlertingTemplatesWrite,
  ],
  [NotificationTemplateAction.Update]: [
    notificationsPermissions.update.grafana,
    AccessControlAction.AlertingTemplatesWrite,
  ],
  [NotificationTemplateAction.Delete]: [
    notificationsPermissions.delete.grafana,
    AccessControlAction.AlertingTemplatesDelete,
  ],
  [NotificationTemplateAction.Test]: [
    AccessControlAction.AlertingNotificationsTemplatesTest,
    notificationsPermissions.update.grafana,
  ],
};

/** Permissions for external alertmanagers (Mimir, Cortex, Vanilla Alertmanager, etc.). */
const EXTERNAL_AM_PERMISSIONS: Record<NotificationTemplateAction, AccessControlAction[]> = {
  [NotificationTemplateAction.View]: [notificationsPermissions.read.external],
  [NotificationTemplateAction.Create]: [notificationsPermissions.create.external],
  [NotificationTemplateAction.Update]: [notificationsPermissions.update.external],
  [NotificationTemplateAction.Delete]: [notificationsPermissions.delete.external],
  [NotificationTemplateAction.Test]: [notificationsPermissions.update.external],
};

/**
 * Global (unscoped) notification template ability check.
 *
 * Use this in navigation and any context outside AlertmanagerContext. Performs a pure
 * RBAC check with no alertmanager-type gate. Scoped provenance checks are omitted.
 */
export function useGlobalNotificationTemplateAbility(action: NotificationTemplateAction): Ability {
  return useMemo(() => makeAbility(true, PERMISSIONS[action]), [action]);
}

export function useNotificationTemplateAbility(payload: NotificationTemplateAbilityParam): Ability {
  const { hasConfigurationAPI, isGrafanaAlertmanager } = useAlertmanager();

  return useMemo(() => {
    // Select the permission set that matches the current alertmanager type so that
    // Grafana AM permissions are never checked against an external AM and vice-versa.
    const perms = isGrafanaAlertmanager ? PERMISSIONS : EXTERNAL_AM_PERMISSIONS;

    switch (payload.action) {
      case NotificationTemplateAction.View:
        // View is always supported — templates can be listed from any AM type.
        return makeAbility(true, perms[NotificationTemplateAction.View]);

      case NotificationTemplateAction.Create:
        return makeAbility(hasConfigurationAPI, perms[NotificationTemplateAction.Create]);

      case NotificationTemplateAction.Update:
      case NotificationTemplateAction.Delete:
      case NotificationTemplateAction.Test: {
        if (!hasConfigurationAPI) {
          return NotSupported;
        }
        if (payload.context && isProvisionedResource(payload.context.provenance)) {
          return Provisioned;
        }
        return makeAbility(true, perms[payload.action]);
      }
    }
  }, [payload, hasConfigurationAPI, isGrafanaAlertmanager]);
}

export const PERMISSIONS_TEMPLATES: AccessControlAction[] = Object.values(PERMISSIONS).flatMap(
  (permissions) => permissions
);

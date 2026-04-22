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
  [NotificationTemplateAction.Delete]: [notificationsPermissions.delete.grafana],
  [NotificationTemplateAction.Test]: [
    AccessControlAction.AlertingNotificationsTemplatesTest,
    notificationsPermissions.update.grafana,
  ],
};

/**
 * Global (unscoped) notification template ability check.
 *
 * Use this in navigation and any context outside AlertmanagerContext. Performs a pure
 * RBAC check with no alertmanager-type gate. Scoped provenance checks are omitted.
 */
export function useGlobalNotificationTemplateAbility(action: NotificationTemplateAction): Ability {
  return makeAbility(true, PERMISSIONS[action]);
}

export function useNotificationTemplateAbility(payload: NotificationTemplateAbilityParam): Ability {
  const { hasConfigurationAPI } = useAlertmanager();

  return useMemo(() => {
    switch (payload.action) {
      case NotificationTemplateAction.View:
      case NotificationTemplateAction.Create:
        return makeAbility(hasConfigurationAPI, PERMISSIONS[payload.action]);

      case NotificationTemplateAction.Update:
      case NotificationTemplateAction.Delete:
      case NotificationTemplateAction.Test: {
        if (!hasConfigurationAPI) {
          return NotSupported;
        }
        if (payload.context && isProvisionedResource(payload.context.provenance)) {
          return Provisioned;
        }
        return makeAbility(true, PERMISSIONS[payload.action]);
      }
    }
  }, [payload, hasConfigurationAPI]);
}

/** All permissions that gate template functionality — used by datasource access-control checks. */
export const PERMISSIONS_TEMPLATES: AccessControlAction[] = Object.values(PERMISSIONS).flatMap(
  (permissions) => permissions
);

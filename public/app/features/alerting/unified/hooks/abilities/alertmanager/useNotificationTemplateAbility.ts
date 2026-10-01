import { useMemo } from 'react';

import { type NotificationTemplate } from '../../../components/contact-points/useNotificationTemplates';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import {
  externalNotificationTemplatePermissions as EXTERNAL_AM_PERMISSIONS,
  grafanaNotificationTemplatePermissions as PERMISSIONS,
} from '../../../utils/alertmanagerPermissions';
import { isProvisionedResource } from '../../../utils/k8s/utils';
import { makeAbility } from '../abilityUtils';
import { type Ability, NotSupported, NotificationTemplateAction, Provisioned } from '../types';

export type NotificationTemplateAbilityParam =
  | { action: NotificationTemplateAction.View }
  | { action: NotificationTemplateAction.Create }
  | { action: NotificationTemplateAction.Update; context?: NotificationTemplate }
  | { action: NotificationTemplateAction.Delete; context?: NotificationTemplate }
  | { action: NotificationTemplateAction.Test; context?: NotificationTemplate };

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

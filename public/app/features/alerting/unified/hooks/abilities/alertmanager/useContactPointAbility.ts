import { useMemo } from 'react';

import { getContactPointInUseRoutes, getContactPointInUseRules } from '@grafana/alerting/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { notificationsPermissions } from '../../../utils/access-control';
import {
  type EntityToCheck,
  canDeleteEntity,
  canEditEntity,
  canTestEntity,
  shouldUseK8sApi,
} from '../../../utils/k8s/utils';
import { makeAbility, makeScopedAbility } from '../abilityUtils';
import { type Ability, ContactPointAction, Granted, InUse, InsufficientPermissions } from '../types';

export type ContactPointAbilityParam =
  | { action: ContactPointAction.View }
  | { action: ContactPointAction.Create }
  | { action: ContactPointAction.BulkExport }
  | { action: ContactPointAction.Update; context?: EntityToCheck }
  | { action: ContactPointAction.Delete; context: EntityToCheck }
  | { action: ContactPointAction.Export; context: EntityToCheck }
  | { action: ContactPointAction.Test; context?: EntityToCheck };

/** Permissions for the Grafana-managed alertmanager (internal k8s API). */
const PERMISSIONS: Record<ContactPointAction, AccessControlAction[]> = {
  [ContactPointAction.View]: [notificationsPermissions.read.grafana, AccessControlAction.AlertingReceiversRead],
  [ContactPointAction.Create]: [notificationsPermissions.create.grafana, AccessControlAction.AlertingReceiversCreate],
  [ContactPointAction.Update]: [notificationsPermissions.update.grafana, AccessControlAction.AlertingReceiversWrite],
  [ContactPointAction.Delete]: [notificationsPermissions.delete.grafana, AccessControlAction.AlertingReceiversDelete],
  [ContactPointAction.Export]: [notificationsPermissions.read.grafana, AccessControlAction.AlertingReceiversRead],
  [ContactPointAction.BulkExport]: [notificationsPermissions.read.grafana, AccessControlAction.AlertingReceiversRead],
  [ContactPointAction.Test]: [
    notificationsPermissions.update.grafana, // alert.notifications:write — legacy broad permission
    AccessControlAction.AlertingReceiversTest, // deprecated specific action, kept for backward compat
    AccessControlAction.AlertingReceiversTestCreate, // current scoped test action
  ],
};

/** Permissions for external alertmanagers (Mimir, Cortex, Vanilla Alertmanager, etc.). */
const EXTERNAL_AM_PERMISSIONS: Record<ContactPointAction, AccessControlAction[]> = {
  [ContactPointAction.View]: [notificationsPermissions.read.external],
  [ContactPointAction.Create]: [notificationsPermissions.create.external],
  [ContactPointAction.Update]: [notificationsPermissions.update.external],
  [ContactPointAction.Delete]: [notificationsPermissions.delete.external],
  [ContactPointAction.Export]: [notificationsPermissions.read.external],
  [ContactPointAction.BulkExport]: [], // Not applicable — gated by isGrafanaAlertmanager
  [ContactPointAction.Test]: [], // Not applicable — the k8s test endpoint is Grafana AM only
};

export const PERMISSIONS_CONTACT_POINTS: AccessControlAction[] = Object.values(PERMISSIONS).flatMap(
  (permissions) => permissions
);

/**
 * Global (unscoped) contact point ability check.
 *
 * Use this in navigation and any context outside AlertmanagerContext (e.g. nav hooks,
 * rule-list filter). Performs a pure RBAC check with no alertmanager-type gate.
 *
 * This intentionally always uses the Grafana-AM `PERMISSIONS` map, not `EXTERNAL_AM_PERMISSIONS`.
 * Call sites (e.g. `fetchStatuses` in ContactPointsTab) need to know whether the current user
 * holds *any* relevant permission without being tied to a specific alertmanager type. The Grafana-AM
 * permission set covers the Grafana-internal APIs (e.g. the receiver status endpoint accepts both
 * `alert.notifications:read` and `alert.notifications.receivers:read`, confirmed in
 * pkg/services/ngalert/api/authorization.go). External-AM-only users do not interact with those
 * APIs, so excluding them from the check is correct.
 */
export function useGlobalContactPointAbility(action: ContactPointAction): Ability {
  return useMemo(() => makeAbility(true, PERMISSIONS[action]), [action]);
}

export function useContactPointAbility(payload: ContactPointAbilityParam): Ability {
  const { selectedAlertmanager, hasConfigurationAPI, isGrafanaAlertmanager } = useAlertmanager();

  return useMemo(() => {
    const usingK8sApi = shouldUseK8sApi(selectedAlertmanager!);
    // Select the permission set that matches the current alertmanager type so that
    // Grafana AM permissions are never checked against an external AM and vice-versa.
    const permissions = isGrafanaAlertmanager ? PERMISSIONS : EXTERNAL_AM_PERMISSIONS;

    switch (payload.action) {
      case ContactPointAction.View:
        // View is always supported — contact points can be listed from any AM type.
        return makeAbility(true, permissions[ContactPointAction.View]);

      case ContactPointAction.Create:
        return makeAbility(hasConfigurationAPI, permissions[ContactPointAction.Create]);

      case ContactPointAction.BulkExport:
        // Grafana-managed AM only (mirrors the legacy [isGrafanaFlavoredAlertmanager, …] tuple).
        return makeAbility(isGrafanaAlertmanager, permissions[ContactPointAction.BulkExport]);

      case ContactPointAction.Update:
        // External AM contact points are plain receivers without k8s access annotations.
        // Skip the entity check and use pure RBAC when no k8s API is in use, or when the
        // caller has no entity to pass (e.g. EditReceiverView for cloud AMs).
        if (payload.context === undefined || !usingK8sApi) {
          return makeAbility(hasConfigurationAPI, permissions[ContactPointAction.Update]);
        }
        return makeScopedAbility(
          hasConfigurationAPI,
          permissions[ContactPointAction.Update],
          payload.context,
          (entity) =>
            canEditEntity(entity) ? Granted : InsufficientPermissions(permissions[ContactPointAction.Update])
        );

      case ContactPointAction.Delete:
        if (!usingK8sApi) {
          return makeAbility(hasConfigurationAPI, permissions[ContactPointAction.Delete]);
        }
        return makeScopedAbility(
          hasConfigurationAPI,
          permissions[ContactPointAction.Delete],
          payload.context,
          canDeleteContactPoint
        );

      case ContactPointAction.Export:
        if (!usingK8sApi) {
          return makeAbility(hasConfigurationAPI, permissions[ContactPointAction.Export]);
        }
        return makeScopedAbility(hasConfigurationAPI, permissions[ContactPointAction.Export], payload.context);

      case ContactPointAction.Test:
        // The k8s integration-test endpoint exists only on the Grafana AM.
        if (!isGrafanaAlertmanager || !hasConfigurationAPI) {
          return makeAbility(false, PERMISSIONS[ContactPointAction.Test]);
        }
        // When we have a context (existing contact point), defer to the server-set canTest
        // annotation. Deliberately bypass makeScopedAbility: provisioned contact points CAN
        // still be tested when the user holds the test:create RBAC action, so we must not
        // apply the provisioning guard that makeScopedAbility adds for Update/Delete.
        if (usingK8sApi && payload.context !== undefined) {
          return canTestEntity(payload.context)
            ? Granted
            : InsufficientPermissions(PERMISSIONS[ContactPointAction.Test]);
        }
        // New contact point (no context yet) — fall back to pure RBAC.
        return makeAbility(true, PERMISSIONS[ContactPointAction.Test]);
    }
  }, [payload, hasConfigurationAPI, isGrafanaAlertmanager, selectedAlertmanager]);
}

/**
 * Entity-check function for the Delete action on a contact point.
 *
 * Checks the server-set access annotation first (same as {@link canDeleteEntity}), then
 * inspects the in-use annotations to surface whether the contact point is still referenced
 * by notification policy routes, alert rules using simplified routing, or both.
 *
 * Only called when `usingK8sApi = true` (Grafana AM), so `PERMISSIONS[Delete]` (Grafana-only)
 * is always the correct permission set to surface in the InsufficientPermissions result.
 */
function canDeleteContactPoint(entity: EntityToCheck): Ability {
  if (!canDeleteEntity(entity)) {
    return InsufficientPermissions(PERMISSIONS[ContactPointAction.Delete]);
  }

  const blockedBy: Extract<Ability, { cause: 'IN_USE' }>['blockedBy'] = [];
  if (getContactPointInUseRoutes(entity) > 0) {
    blockedBy.push('routes');
  }
  if (getContactPointInUseRules(entity) > 0) {
    blockedBy.push('rules');
  }
  if (blockedBy.length > 0) {
    return InUse(blockedBy);
  }

  return Granted;
}

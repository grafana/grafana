import { useMemo } from 'react';

import { AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { notificationsPermissions } from '../../../utils/access-control';
import { type EntityToCheck, canDeleteEntity, canEditEntity, isK8sEntityProvisioned } from '../../../utils/k8s/utils';
import { makeAbility } from '../abilityUtils';
import { type Ability, ContactPointAction, InsufficientPermissions, NotSupported, Provisioned } from '../types';

export type ContactPointAbilityParam =
  | { action: ContactPointAction.View }
  | { action: ContactPointAction.Create }
  | { action: ContactPointAction.BulkExport }
  | { action: ContactPointAction.Update; context: EntityToCheck }
  | { action: ContactPointAction.Delete; context: EntityToCheck }
  | { action: ContactPointAction.Export; context: EntityToCheck };

const PERMISSIONS: Record<ContactPointAction, AccessControlAction[]> = {
  [ContactPointAction.View]: [notificationsPermissions.read.grafana, AccessControlAction.AlertingReceiversRead],
  [ContactPointAction.Create]: [notificationsPermissions.create.grafana, AccessControlAction.AlertingReceiversCreate],
  [ContactPointAction.Update]: [notificationsPermissions.update.grafana, AccessControlAction.AlertingReceiversWrite],
  [ContactPointAction.Delete]: [notificationsPermissions.delete.grafana, AccessControlAction.AlertingReceiversWrite],
  [ContactPointAction.Export]: [notificationsPermissions.read.grafana],
  [ContactPointAction.BulkExport]: [notificationsPermissions.read.grafana],
};

export const PERMISSIONS_CONTACT_POINTS: AccessControlAction[] = Object.values(PERMISSIONS).flatMap(
  (permissions) => permissions
);

/**
 * Global (unscoped) contact point ability check.
 *
 * Use this in navigation and any context outside AlertmanagerContext (e.g. nav hooks,
 * rule-list filter). Performs a pure RBAC check with no alertmanager-type gate.
 */
export function useGlobalContactPointAbility(action: ContactPointAction): Ability {
  return makeAbility(true, PERMISSIONS[action]);
}

export function useContactPointAbility(payload: ContactPointAbilityParam): Ability {
  const { hasConfigurationAPI } = useAlertmanager();

  return useMemo(() => {
    switch (payload.action) {
      case ContactPointAction.View:
      case ContactPointAction.Create:
      case ContactPointAction.BulkExport:
        return makeAbility(hasConfigurationAPI, PERMISSIONS[payload.action]);

      case ContactPointAction.Update: {
        if (!hasConfigurationAPI) {
          return NotSupported;
        }
        if (isK8sEntityProvisioned(payload.context)) {
          return Provisioned;
        }
        if (!canEditEntity(payload.context)) {
          return InsufficientPermissions(PERMISSIONS[ContactPointAction.Update]);
        }
        return makeAbility(true, PERMISSIONS[ContactPointAction.Update]);
      }

      case ContactPointAction.Delete: {
        if (!hasConfigurationAPI) {
          return NotSupported;
        }
        if (isK8sEntityProvisioned(payload.context)) {
          return Provisioned;
        }
        if (!canDeleteEntity(payload.context)) {
          return InsufficientPermissions(PERMISSIONS[ContactPointAction.Delete]);
        }
        return makeAbility(true, PERMISSIONS[ContactPointAction.Delete]);
      }

      case ContactPointAction.Export: {
        if (!hasConfigurationAPI) {
          return NotSupported;
        }
        if (isK8sEntityProvisioned(payload.context)) {
          return Provisioned;
        }
        return makeAbility(true, PERMISSIONS[ContactPointAction.View]);
      }
    }
  }, [payload, hasConfigurationAPI]);
}

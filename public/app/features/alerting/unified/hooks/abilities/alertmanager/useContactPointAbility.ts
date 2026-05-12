import { useMemo } from 'react';

import { AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { notificationsPermissions } from '../../../utils/access-control';
import { type EntityToCheck, canDeleteEntity, canEditEntity } from '../../../utils/k8s/utils';
import { makeAbility, makeScopedAbility } from '../abilityUtils';
import { type Ability, ContactPointAction } from '../types';

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
  [ContactPointAction.Delete]: [notificationsPermissions.delete.grafana, AccessControlAction.AlertingReceiversDelete],
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
  return useMemo(() => makeAbility(true, PERMISSIONS[action]), [action]);
}

export function useContactPointAbility(payload: ContactPointAbilityParam): Ability {
  const { hasConfigurationAPI } = useAlertmanager();

  return useMemo(() => {
    switch (payload.action) {
      case ContactPointAction.View:
      case ContactPointAction.Create:
      case ContactPointAction.BulkExport:
        return makeAbility(hasConfigurationAPI, PERMISSIONS[payload.action]);

      case ContactPointAction.Update:
        return makeScopedAbility(
          hasConfigurationAPI,
          PERMISSIONS[ContactPointAction.Update],
          payload.context,
          canEditEntity
        );

      case ContactPointAction.Delete:
        return makeScopedAbility(
          hasConfigurationAPI,
          PERMISSIONS[ContactPointAction.Delete],
          payload.context,
          canDeleteEntity
        );

      case ContactPointAction.Export:
        return makeScopedAbility(hasConfigurationAPI, PERMISSIONS[ContactPointAction.Export], payload.context);
    }
  }, [payload, hasConfigurationAPI]);
}

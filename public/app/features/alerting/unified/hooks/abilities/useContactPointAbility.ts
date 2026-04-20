import { PERMISSIONS_CONTACT_POINTS_READ } from 'app/features/alerting/unified/components/contact-points/permissions';
import { AccessControlAction } from 'app/types/accessControl';

import { notificationsPermissions } from '../../utils/access-control';
import { type EntityToCheck, canDeleteEntity, canEditEntity, isK8sEntityProvisioned } from '../../utils/k8s/utils';

import { makeAbility } from './abilityUtils';
import { type Ability, ContactPointAction, InsufficientPermissions, Provisioned } from './types';

export type ContactPointAbilityParam =
  | { action: ContactPointAction.View }
  | { action: ContactPointAction.Create }
  | { action: ContactPointAction.BulkExport }
  | { action: ContactPointAction.Update; context: EntityToCheck }
  | { action: ContactPointAction.Delete; context: EntityToCheck }
  | { action: ContactPointAction.Export; context: EntityToCheck };

const PERMISSIONS: Record<ContactPointAction, AccessControlAction[]> = {
  [ContactPointAction.View]: [notificationsPermissions.read.grafana, ...PERMISSIONS_CONTACT_POINTS_READ],
  [ContactPointAction.Create]: [notificationsPermissions.create.grafana, AccessControlAction.AlertingReceiversCreate],
  [ContactPointAction.Update]: [notificationsPermissions.update.grafana, AccessControlAction.AlertingReceiversWrite],
  [ContactPointAction.Delete]: [notificationsPermissions.delete.grafana, AccessControlAction.AlertingReceiversWrite],
  [ContactPointAction.Export]: [notificationsPermissions.read.grafana],
  [ContactPointAction.BulkExport]: [notificationsPermissions.read.grafana],
};

export function useContactPointAbility(payload: ContactPointAbilityParam): Ability {
  switch (payload.action) {
    case ContactPointAction.View:
    case ContactPointAction.Create:
    case ContactPointAction.BulkExport:
      return makeAbility(true, PERMISSIONS[payload.action]);

    case ContactPointAction.Update: {
      if (isK8sEntityProvisioned(payload.context)) {
        return Provisioned;
      }
      if (!canEditEntity(payload.context)) {
        return InsufficientPermissions(PERMISSIONS[ContactPointAction.Update]);
      }
      return makeAbility(true, PERMISSIONS[ContactPointAction.Update]);
    }

    case ContactPointAction.Delete: {
      if (isK8sEntityProvisioned(payload.context)) {
        return Provisioned;
      }
      if (!canDeleteEntity(payload.context)) {
        return InsufficientPermissions(PERMISSIONS[ContactPointAction.Delete]);
      }
      return makeAbility(true, PERMISSIONS[ContactPointAction.Delete]);
    }

    case ContactPointAction.Export: {
      if (isK8sEntityProvisioned(payload.context)) {
        return Provisioned;
      }
      return makeAbility(true, PERMISSIONS[ContactPointAction.View]);
    }
  }
}

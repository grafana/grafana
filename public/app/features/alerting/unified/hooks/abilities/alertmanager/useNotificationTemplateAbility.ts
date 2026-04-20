import { AccessControlAction } from 'app/types/accessControl';

import { type NotificationTemplate } from '../../../components/contact-points/useNotificationTemplates';
import { notificationsPermissions } from '../../../utils/access-control';
import { isProvisionedResource } from '../../../utils/k8s/utils';
import { makeAbility } from '../abilityUtils';
import { type Ability, NotificationTemplateAction, Provisioned } from '../types';

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

export function useNotificationTemplateAbility(payload: NotificationTemplateAbilityParam): Ability {
  switch (payload.action) {
    case NotificationTemplateAction.View:
    case NotificationTemplateAction.Create:
      return makeAbility(true, PERMISSIONS[payload.action]);

    case NotificationTemplateAction.Update:
    case NotificationTemplateAction.Delete:
    case NotificationTemplateAction.Test: {
      if (payload.context && isProvisionedResource(payload.context.provenance)) {
        return Provisioned;
      }
      return makeAbility(true, PERMISSIONS[payload.action]);
    }
  }
}

/** All permissions that gate template functionality — used by datasource access-control checks. */
export const PERMISSIONS_TEMPLATES: AccessControlAction[] = Object.values(PERMISSIONS).flatMap(
  (permissions) => permissions
);

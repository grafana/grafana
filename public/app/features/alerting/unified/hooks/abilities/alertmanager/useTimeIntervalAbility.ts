import { useMemo } from 'react';

import { AccessControlAction } from 'app/types/accessControl';

import { type MuteTiming } from '../../../components/mute-timings/useMuteTimings';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { notificationsPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability, NotSupported, Provisioned, TimeIntervalAction } from '../types';

export type TimeIntervalAbilityParam =
  | { action: TimeIntervalAction.View }
  | { action: TimeIntervalAction.Create }
  | { action: TimeIntervalAction.Export }
  | { action: TimeIntervalAction.Update; context?: MuteTiming }
  | { action: TimeIntervalAction.Delete; context?: MuteTiming };

const PERMISSIONS: Record<TimeIntervalAction, AccessControlAction[]> = {
  [TimeIntervalAction.View]: [notificationsPermissions.read.grafana, AccessControlAction.AlertingTimeIntervalsRead],
  [TimeIntervalAction.Create]: [
    notificationsPermissions.create.grafana,
    AccessControlAction.AlertingTimeIntervalsWrite,
  ],
  [TimeIntervalAction.Update]: [
    notificationsPermissions.update.grafana,
    AccessControlAction.AlertingTimeIntervalsWrite,
  ],
  [TimeIntervalAction.Delete]: [
    notificationsPermissions.delete.grafana,
    AccessControlAction.AlertingTimeIntervalsDelete,
  ],
  [TimeIntervalAction.Export]: [notificationsPermissions.read.grafana],
};

/**
 * Flat "any-of" permission bundle consumed by `getAlertManagerDataSourcesByPermission`
 * in `utils/datasource.ts` to decide whether to show the internal Grafana alertmanager.
 *
 * Derived from the per-action `PERMISSIONS` record above — a user with any permission
 * listed against any time-interval action is considered capable of doing something
 * meaningful with the Grafana alertmanager and will see it in the list.
 */
export const PERMISSIONS_TIME_INTERVALS: AccessControlAction[] = Object.values(PERMISSIONS).flatMap(
  (permissions) => permissions
);

/**
 * Global (unscoped) time interval ability check.
 *
 * Use this in navigation and any context outside AlertmanagerContext. Performs a pure
 * RBAC check with no alertmanager-type gate. Scoped provenance checks are omitted.
 */
export function useGlobalTimeIntervalAbility(action: TimeIntervalAction): Ability {
  return makeAbility(true, PERMISSIONS[action]);
}

export function useTimeIntervalAbility(payload: TimeIntervalAbilityParam): Ability {
  const { hasConfigurationAPI } = useAlertmanager();

  return useMemo(() => {
    switch (payload.action) {
      case TimeIntervalAction.View:
      case TimeIntervalAction.Create:
      case TimeIntervalAction.Export:
        return makeAbility(hasConfigurationAPI, PERMISSIONS[payload.action]);

      case TimeIntervalAction.Update:
      case TimeIntervalAction.Delete: {
        if (!hasConfigurationAPI) {
          return NotSupported;
        }
        if (payload.context?.provisioned) {
          return Provisioned;
        }
        return makeAbility(true, PERMISSIONS[payload.action]);
      }
    }
  }, [payload, hasConfigurationAPI]);
}

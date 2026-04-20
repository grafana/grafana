import { AccessControlAction } from 'app/types/accessControl';

import { type MuteTiming } from '../../../components/mute-timings/useMuteTimings';
import { notificationsPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability, Provisioned, TimeIntervalAction } from '../types';

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
    AccessControlAction.AlertingTimeIntervalsWrite,
  ],
  [TimeIntervalAction.Export]: [notificationsPermissions.read.grafana],
};

/** Granular permissions that allow viewing time intervals. */
export const PERMISSIONS_TIME_INTERVALS_READ = [AccessControlAction.AlertingTimeIntervalsRead];

/** Granular permissions that allow modifying time intervals. */
export const PERMISSIONS_TIME_INTERVALS_MODIFY = [AccessControlAction.AlertingTimeIntervalsWrite];

/** All permissions that gate time interval functionality — used by datasource access-control checks. */
export const PERMISSIONS_TIME_INTERVALS: AccessControlAction[] = Object.values(PERMISSIONS).flatMap(
  (permissions) => permissions
);

export function useTimeIntervalAbility(payload: TimeIntervalAbilityParam): Ability {
  switch (payload.action) {
    case TimeIntervalAction.View:
    case TimeIntervalAction.Create:
    case TimeIntervalAction.Export:
      return makeAbility(true, PERMISSIONS[payload.action]);

    case TimeIntervalAction.Update:
    case TimeIntervalAction.Delete: {
      if (payload.context?.provisioned) {
        return Provisioned;
      }
      return makeAbility(true, PERMISSIONS[payload.action]);
    }
  }
}

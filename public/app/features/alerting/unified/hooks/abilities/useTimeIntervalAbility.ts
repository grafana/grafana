import {
  PERMISSIONS_TIME_INTERVALS_MODIFY,
  PERMISSIONS_TIME_INTERVALS_READ,
} from 'app/features/alerting/unified/components/mute-timings/permissions';
import { AccessControlAction } from 'app/types/accessControl';

import { type MuteTiming } from '../../components/mute-timings/useMuteTimings';
import { notificationsPermissions } from '../../utils/access-control';

import { makeAbility } from './abilityUtils';
import { type Ability, Provisioned, TimeIntervalAction } from './types';

export type TimeIntervalAbilityParam =
  | { action: TimeIntervalAction.View }
  | { action: TimeIntervalAction.Create }
  | { action: TimeIntervalAction.Export }
  | { action: TimeIntervalAction.Update; context?: MuteTiming }
  | { action: TimeIntervalAction.Delete; context?: MuteTiming };

const PERMISSIONS: Record<TimeIntervalAction, AccessControlAction[]> = {
  [TimeIntervalAction.View]: [notificationsPermissions.read.grafana, ...PERMISSIONS_TIME_INTERVALS_READ],
  [TimeIntervalAction.Create]: [notificationsPermissions.create.grafana, ...PERMISSIONS_TIME_INTERVALS_MODIFY],
  [TimeIntervalAction.Update]: [notificationsPermissions.update.grafana, ...PERMISSIONS_TIME_INTERVALS_MODIFY],
  [TimeIntervalAction.Delete]: [notificationsPermissions.delete.grafana, ...PERMISSIONS_TIME_INTERVALS_MODIFY],
  [TimeIntervalAction.Export]: [notificationsPermissions.read.grafana],
};

export function useTimeIntervalAbility(payload: TimeIntervalAbilityParam): Ability {
  switch (payload.action) {
    case TimeIntervalAction.View:
    case TimeIntervalAction.Create:
    case TimeIntervalAction.Export:
      return makeAbility(true, PERMISSIONS[payload.action]);

    case TimeIntervalAction.Update:
    case TimeIntervalAction.Delete: {
      if (payload.context?.provisioned) return Provisioned;
      return makeAbility(true, PERMISSIONS[payload.action]);
    }
  }
}

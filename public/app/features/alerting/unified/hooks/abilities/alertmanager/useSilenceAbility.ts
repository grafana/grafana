import { useMemo } from 'react';

import { type Silence } from 'app/plugins/datasource/alertmanager/types';
import { type AccessControlAction } from 'app/types/accessControl';

import { getInstancesPermissions, instancesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability, InsufficientPermissions, SilenceAction } from '../types';

export type SilenceAbilityParam =
  | { action: SilenceAction.View }
  | { action: SilenceAction.Create }
  | { action: SilenceAction.Preview }
  | { action: SilenceAction.Update; context?: Silence };

const PERMISSIONS: Record<SilenceAction, AccessControlAction[]> = {
  [SilenceAction.View]: [instancesPermissions.read.grafana],
  [SilenceAction.Create]: [instancesPermissions.create.grafana],
  [SilenceAction.Update]: [instancesPermissions.update.grafana],
  [SilenceAction.Preview]: [instancesPermissions.read.grafana],
};

/**
 * Returns the silence-create ability for the given alertmanager source.
 * Handles both Grafana-managed (AlertingInstanceCreate) and external alertmanagers
 * (AlertingInstancesExternalWrite) based on the source name.
 */
export function useAlertmanagerSilenceCreateAbility(alertManagerSourceName: string): Ability {
  return useMemo(() => {
    const permissions = getInstancesPermissions(alertManagerSourceName);
    return makeAbility(true, [permissions.create]);
  }, [alertManagerSourceName]);
}

export function useSilenceAbility(payload: SilenceAbilityParam): Ability {
  switch (payload.action) {
    case SilenceAction.View:
    case SilenceAction.Create:
    case SilenceAction.Preview:
      return makeAbility(true, PERMISSIONS[payload.action]);

    case SilenceAction.Update: {
      if (payload.context?.accessControl?.write === false) {
        return InsufficientPermissions(PERMISSIONS[SilenceAction.Update]);
      }
      return makeAbility(true, PERMISSIONS[SilenceAction.Update]);
    }
  }
}

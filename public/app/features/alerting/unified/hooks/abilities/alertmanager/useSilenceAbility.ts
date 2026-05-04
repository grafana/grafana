import { useMemo } from 'react';

import { type Silence } from 'app/plugins/datasource/alertmanager/types';
import { type AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { getInstancesPermissions, instancesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type AsyncAbility, InsufficientPermissions, Loading, SilenceAction } from '../types';

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

export function useSilenceAbility(payload: SilenceAbilityParam): AsyncAbility {
  const { selectedAlertmanager } = useAlertmanager();

  return useMemo(() => {
    switch (payload.action) {
      case SilenceAction.View:
      case SilenceAction.Preview:
        return makeAbility(true, PERMISSIONS[payload.action]);

      case SilenceAction.Create: {
        // Permission differs between Grafana-managed and external alertmanagers.
        // Return Loading until the selected alertmanager is resolved so callers
        // can render a disabled button rather than making a decision with no context.
        if (selectedAlertmanager === undefined) {
          return Loading;
        }
        const permissions = getInstancesPermissions(selectedAlertmanager);
        return makeAbility(true, [permissions.create]);
      }

      case SilenceAction.Update: {
        if (payload.context?.accessControl?.write === false) {
          return InsufficientPermissions(PERMISSIONS[SilenceAction.Update]);
        }
        return makeAbility(true, PERMISSIONS[SilenceAction.Update]);
      }
    }
  }, [payload, selectedAlertmanager]);
}

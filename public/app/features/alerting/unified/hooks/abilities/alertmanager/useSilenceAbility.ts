import { useMemo } from 'react';

import { type Silence } from 'app/plugins/datasource/alertmanager/types';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { getInstancesPermissions, instancesPermissions, silencesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type AsyncAbility, InsufficientPermissions, Loading, SilenceAction } from '../types';

export type SilenceAbilityParam =
  | { action: SilenceAction.View }
  | { action: SilenceAction.Create }
  | { action: SilenceAction.Preview }
  | { action: SilenceAction.Update; context?: Silence };

export function useSilenceAbility(payload: SilenceAbilityParam): AsyncAbility {
  const { selectedAlertmanager } = useAlertmanager();

  return useMemo(() => {
    switch (payload.action) {
      case SilenceAction.View:
      case SilenceAction.Preview: {
        // Permission differs between Grafana-managed and external alertmanagers.
        // Return Loading until the selected alertmanager is resolved.
        if (selectedAlertmanager === undefined) {
          return Loading;
        }
        const permissions = getInstancesPermissions(selectedAlertmanager);
        // For Grafana AM, also accept alert.silences:read — the backend HTTP gate
        // accepts either action and the frontend should mirror that.
        const acceptedPermissions =
          permissions.read === instancesPermissions.read.grafana
            ? [instancesPermissions.read.grafana, silencesPermissions.read.grafana]
            : [permissions.read];
        return makeAbility(true, acceptedPermissions);
      }

      case SilenceAction.Create: {
        // Permission differs between Grafana-managed and external alertmanagers.
        // Return Loading until the selected alertmanager is resolved so callers
        // can render a disabled button rather than making a decision with no context.
        if (selectedAlertmanager === undefined) {
          return Loading;
        }
        const permissions = getInstancesPermissions(selectedAlertmanager);
        // For Grafana AM, also accept alert.silences:create — the backend HTTP gate
        // accepts either action and the frontend should mirror that.
        const acceptedPermissions =
          permissions.create === instancesPermissions.create.grafana
            ? [instancesPermissions.create.grafana, silencesPermissions.create.grafana]
            : [permissions.create];
        return makeAbility(true, acceptedPermissions);
      }

      case SilenceAction.Update: {
        // Permission differs between Grafana-managed and external alertmanagers.
        // Return Loading until the selected alertmanager is resolved.
        if (selectedAlertmanager === undefined) {
          return Loading;
        }
        const permissions = getInstancesPermissions(selectedAlertmanager);
        // For Grafana AM, also accept alert.silences:write — the backend HTTP gate
        // accepts either action and the frontend should mirror that.
        const acceptedPermissions =
          permissions.update === instancesPermissions.update.grafana
            ? [instancesPermissions.update.grafana, silencesPermissions.update.grafana]
            : [permissions.update];

        if (payload.context?.accessControl?.write === false) {
          return InsufficientPermissions(acceptedPermissions);
        }
        return makeAbility(true, acceptedPermissions);
      }
    }
  }, [payload, selectedAlertmanager]);
}

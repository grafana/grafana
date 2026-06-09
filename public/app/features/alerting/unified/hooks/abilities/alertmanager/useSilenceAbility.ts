import { useMemo } from 'react';

import { type Silence } from 'app/plugins/datasource/alertmanager/types';
import { type AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { instancesPermissions, silencesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type AsyncAbility, InsufficientPermissions, Loading, SilenceAction } from '../types';

export type SilenceAbilityParam =
  | { action: SilenceAction.View }
  | { action: SilenceAction.Create }
  | { action: SilenceAction.Preview }
  | { action: SilenceAction.Update; context?: Silence };

// Backend HTTP gates accept either alert.instances:* or alert.silences:* for Grafana AM.
// Frontend mirrors that by listing both in the accepted set.
const GRAFANA_PERMISSIONS: Record<SilenceAction, AccessControlAction[]> = {
  [SilenceAction.View]: [instancesPermissions.read.grafana, silencesPermissions.read.grafana],
  [SilenceAction.Preview]: [instancesPermissions.read.grafana, silencesPermissions.read.grafana],
  [SilenceAction.Create]: [instancesPermissions.create.grafana, silencesPermissions.create.grafana],
  [SilenceAction.Update]: [instancesPermissions.update.grafana, silencesPermissions.update.grafana],
};

const EXTERNAL_PERMISSIONS: Record<SilenceAction, AccessControlAction[]> = {
  [SilenceAction.View]: [instancesPermissions.read.external],
  [SilenceAction.Preview]: [instancesPermissions.read.external],
  [SilenceAction.Create]: [instancesPermissions.create.external],
  [SilenceAction.Update]: [instancesPermissions.update.external],
};

export function useSilenceAbility(payload: SilenceAbilityParam): AsyncAbility {
  const { selectedAlertmanager, isGrafanaAlertmanager } = useAlertmanager();

  return useMemo(() => {
    // Return Loading until the selected alertmanager is resolved so callers can
    // render disabled controls rather than making a show/hide decision too early.
    if (selectedAlertmanager === undefined) {
      return Loading;
    }

    const permissions = isGrafanaAlertmanager ? GRAFANA_PERMISSIONS : EXTERNAL_PERMISSIONS;

    switch (payload.action) {
      case SilenceAction.View:
      case SilenceAction.Preview:
        return makeAbility(true, permissions[payload.action]);

      case SilenceAction.Create:
        return makeAbility(true, permissions[SilenceAction.Create]);

      case SilenceAction.Update:
        if (payload.context?.accessControl?.write === false) {
          return InsufficientPermissions(permissions[SilenceAction.Update]);
        }
        return makeAbility(true, permissions[SilenceAction.Update]);
    }
  }, [payload, selectedAlertmanager, isGrafanaAlertmanager]);
}

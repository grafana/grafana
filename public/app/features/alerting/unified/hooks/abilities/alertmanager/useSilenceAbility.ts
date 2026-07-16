import { useMemo } from 'react';

import { type Silence } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { useFolder } from '../../../hooks/useFolder';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { instancesPermissions, silencesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability, type AsyncAbility, Granted, InsufficientPermissions, Loading, SilenceAction } from '../types';

export type SilenceAbilityParam =
  | { action: SilenceAction.View }
  | { action: SilenceAction.Create }
  | { action: SilenceAction.Preview }
  | { action: SilenceAction.Update; context?: Silence };

export type GlobalSilenceAbilityParam =
  | { action: SilenceAction.View }
  | { action: SilenceAction.Create; folderUID?: string }
  | { action: SilenceAction.Preview }
  | { action: SilenceAction.Update };

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

/**
 * Global (unscoped) silence ability check, outside of AlertmanagerContext.
 *
 * Performs a pure RBAC check with no alertmanager-type gate.
 *
 * For `SilenceAction.Create`, an optional `folderUID` can be provided to also check
 * folder-level RBAC (`AlertingSilenceCreate` on that folder). When `folderUID` is
 * omitted the folder check is skipped and only global permissions are evaluated.
 */
export function useGlobalSilenceAbility(payload: GlobalSilenceAbilityParam): Ability {
  const folderUID = payload.action === SilenceAction.Create ? payload.folderUID : undefined;
  const { folder } = useFolder(folderUID);

  return useMemo(() => {
    switch (payload.action) {
      case SilenceAction.Create: {
        const globalAbility = makeAbility(true, GRAFANA_PERMISSIONS[SilenceAction.Create]);
        const hasFolderPermission = folder?.accessControl?.[AccessControlAction.AlertingSilenceCreate] ?? false;
        return globalAbility.granted || hasFolderPermission ? Granted : globalAbility;
      }

      case SilenceAction.View:
      case SilenceAction.Preview:
      case SilenceAction.Update:
        return makeAbility(true, GRAFANA_PERMISSIONS[payload.action]);
    }
  }, [payload.action, folder]);
}

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
      case SilenceAction.Create:
        return makeAbility(true, permissions[payload.action]);

      case SilenceAction.Update:
        if (payload.context?.accessControl?.write === false) {
          return InsufficientPermissions(permissions[SilenceAction.Update]);
        }
        return makeAbility(true, permissions[SilenceAction.Update]);
    }
  }, [payload, selectedAlertmanager, isGrafanaAlertmanager]);
}

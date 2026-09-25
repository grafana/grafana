import { useMemo } from 'react';

import { type Silence } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type FolderDTO } from 'app/types/folders';

import { useFolder } from '../../../hooks/useFolder';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { instancesPermissions, silencesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability, type AsyncAbility, Granted, InsufficientPermissions, Loading, SilenceAction } from '../types';

export type SilenceAbilityParam =
  | { action: SilenceAction.View }
  | { action: SilenceAction.Create; folderUID?: string }
  | { action: SilenceAction.Preview }
  | { action: SilenceAction.Update; context?: Silence };

export type GlobalSilenceAbilityParam =
  | { action: SilenceAction.View }
  | { action: SilenceAction.Create; folderUID?: string }
  | { action: SilenceAction.Preview }
  | { action: SilenceAction.Update };

// Backend HTTP gates accept either alert.instances:* or alert.silences:* for Grafana AM.
// Frontend mirrors that by listing both in the accepted set.
//
// Create is the exception. alert.silences:create is always folder-scoped, so it only covers
// silences for a rule in that folder - checked separately against folderUID. A silence that
// isn't tied to a rule needs the org-wide alert.instances:create.
const GRAFANA_PERMISSIONS: Record<SilenceAction, AccessControlAction[]> = {
  [SilenceAction.View]: [instancesPermissions.read.grafana, silencesPermissions.read.grafana],
  [SilenceAction.Preview]: [instancesPermissions.read.grafana, silencesPermissions.read.grafana],
  [SilenceAction.Create]: [instancesPermissions.create.grafana],
  [SilenceAction.Update]: [instancesPermissions.update.grafana, silencesPermissions.update.grafana],
};

const EXTERNAL_PERMISSIONS: Record<SilenceAction, AccessControlAction[]> = {
  [SilenceAction.View]: [instancesPermissions.read.external],
  [SilenceAction.Preview]: [instancesPermissions.read.external],
  [SilenceAction.Create]: [instancesPermissions.create.external],
  [SilenceAction.Update]: [instancesPermissions.update.external],
};

/**
 * A user with AlertingSilenceCreate on a folder may silence the rules that live in it, so this
 * stands in for the org-wide create permission when the silence targets a single rule.
 */
function canCreateSilenceInFolder(folder: FolderDTO | undefined): boolean {
  return folder?.accessControl?.[AccessControlAction.AlertingSilenceCreate] ?? false;
}

/**
 * Global (unscoped) silence ability check, outside of AlertmanagerContext.
 *
 * Performs a pure RBAC check with no alertmanager-type gate.
 *
 * For `SilenceAction.Create`, pass the `folderUID` of the rule the silence will target so
 * folder-level RBAC (`AlertingSilenceCreate` on that folder) is taken into account. Leave it
 * out when the silence is not tied to a single rule - only the org-wide permission counts
 * then, which is what the backend enforces.
 */
export function useGlobalSilenceAbility(payload: GlobalSilenceAbilityParam): Ability {
  const folderUID = payload.action === SilenceAction.Create ? payload.folderUID : undefined;
  const { folder } = useFolder(folderUID);

  return useMemo(() => {
    switch (payload.action) {
      case SilenceAction.Create: {
        const globalAbility = makeAbility(true, GRAFANA_PERMISSIONS[SilenceAction.Create]);
        // Only meaningful when a folderUID was passed: the silence targets a rule in that
        // folder, which folder-level AlertingSilenceCreate is enough to silence.
        return globalAbility.granted || canCreateSilenceInFolder(folder) ? Granted : globalAbility;
      }

      case SilenceAction.View:
      case SilenceAction.Preview:
      case SilenceAction.Update:
        return makeAbility(true, GRAFANA_PERMISSIONS[payload.action]);
    }
  }, [payload.action, folder]);
}

/**
 * Silence ability check within AlertmanagerContext, gated on the selected alertmanager type.
 *
 * For `SilenceAction.Create`, pass the `folderUID` of the rule the silence will target so
 * folder-level RBAC is taken into account; leave it out for a silence that is not tied to a
 * single rule. Folder permissions are only consulted for the Grafana alertmanager - external
 * ones have a single org-wide permission and no notion of which folder a rule lives in.
 */
export function useSilenceAbility(payload: SilenceAbilityParam): AsyncAbility {
  const { selectedAlertmanager, isGrafanaAlertmanager } = useAlertmanager();

  const folderUID = payload.action === SilenceAction.Create && isGrafanaAlertmanager ? payload.folderUID : undefined;
  const { folder, loading: folderLoading } = useFolder(folderUID);

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

      case SilenceAction.Create: {
        const orgWideAbility = makeAbility(true, permissions[SilenceAction.Create]);
        if (orgWideAbility.granted || !folderUID) {
          return orgWideAbility;
        }
        // Hold at Loading rather than denying - until the folder arrives we cannot tell whether
        // the user may silence rules in it.
        if (folderLoading || !folder) {
          return Loading;
        }
        return canCreateSilenceInFolder(folder) ? Granted : orgWideAbility;
      }

      case SilenceAction.Update:
        if (payload.context?.accessControl?.write === false) {
          return InsufficientPermissions(permissions[SilenceAction.Update]);
        }
        return makeAbility(true, permissions[SilenceAction.Update]);
    }
  }, [payload, selectedAlertmanager, isGrafanaAlertmanager, folderUID, folder, folderLoading]);
}

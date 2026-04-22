import { useMemo } from 'react';

import { type AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { getInstancesPermissions, instancesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability, AlertGroupAction, type AsyncAbility, Loading } from '../types';

const GLOBAL_PERMISSIONS: Record<AlertGroupAction, AccessControlAction[]> = {
  // anyOf: show the tab / link when the user can view alert instances from any source
  [AlertGroupAction.View]: [instancesPermissions.read.grafana, instancesPermissions.read.external],
};

/**
 * Global (unscoped) alert group ability check.
 *
 * Use this for navigation and any context where no specific alertmanager is selected.
 * Grants access if the user has read permission on *any* alertmanager instance source.
 */
export function useGlobalAlertGroupAbility(action: AlertGroupAction): Ability {
  return makeAbility(true, GLOBAL_PERMISSIONS[action]);
}

/**
 * Scoped alert group ability check for a specific alertmanager instance.
 *
 * Use this inside components that are wrapped in an AlertmanagerContext.
 * Returns Loading while the selected alertmanager is being resolved, then
 * checks the read permission appropriate for that specific alertmanager.
 */
export function useAlertGroupAbility(action: AlertGroupAction): AsyncAbility {
  const { selectedAlertmanager } = useAlertmanager();

  return useMemo(() => {
    if (selectedAlertmanager === undefined) {
      return Loading;
    }

    const permissions = getInstancesPermissions(selectedAlertmanager);

    switch (action) {
      case AlertGroupAction.View:
        return makeAbility(true, [permissions.read]);
    }
  }, [action, selectedAlertmanager]);
}

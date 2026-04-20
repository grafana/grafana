import { useMemo } from 'react';

import { getInstancesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability } from '../types';

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

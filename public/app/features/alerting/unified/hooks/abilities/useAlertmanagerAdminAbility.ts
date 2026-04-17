import { AccessControlAction } from 'app/types/accessControl';

import { makeAbility } from './abilityUtils';
import { type Ability, AlertmanagerAdminAction } from './types';

const PERMISSIONS: Record<AlertmanagerAdminAction, AccessControlAction[]> = {
  [AlertmanagerAdminAction.DecryptSecrets]: [AccessControlAction.AlertingProvisioningReadSecrets],
};

export function useAlertmanagerAdminAbility(action: AlertmanagerAdminAction): Ability {
  return makeAbility(true, PERMISSIONS[action]);
}

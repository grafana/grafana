import { AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { makeAbility } from '../abilityUtils';
import { type Ability, AlertmanagerAdminAction } from '../types';

const PERMISSIONS: Record<AlertmanagerAdminAction, AccessControlAction[]> = {
  [AlertmanagerAdminAction.DecryptSecrets]: [AccessControlAction.AlertingProvisioningReadSecrets],
};

export function useAlertmanagerAdminAbility(action: AlertmanagerAdminAction): Ability {
  const { isGrafanaAlertmanager } = useAlertmanager();
  return makeAbility(isGrafanaAlertmanager, PERMISSIONS[action]);
}

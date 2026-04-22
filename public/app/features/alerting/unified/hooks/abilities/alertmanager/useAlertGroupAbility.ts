import { type AccessControlAction } from 'app/types/accessControl';

import { instancesPermissions } from '../../../utils/access-control';
import { makeAbility } from '../abilityUtils';
import { type Ability, AlertGroupAction } from '../types';

const PERMISSIONS: Record<AlertGroupAction, AccessControlAction[]> = {
  // anyOf: show the tab / link when the user can view alert instances from any source
  [AlertGroupAction.View]: [instancesPermissions.read.grafana, instancesPermissions.read.external],
};

export function useAlertGroupAbility(action: AlertGroupAction): Ability {
  return makeAbility(true, PERMISSIONS[action]);
}

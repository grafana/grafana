import { AccessControlAction } from 'app/types/accessControl';

import { instancesPermissions } from '../../utils/access-control';

import { makeAbility } from './abilityUtils';
import { type Ability, AlertGroupAction } from './types';

const PERMISSIONS: Record<AlertGroupAction, AccessControlAction[]> = {
  [AlertGroupAction.View]: [instancesPermissions.read.grafana],
};

export function useAlertGroupAbility(action: AlertGroupAction): Ability {
  return makeAbility(true, PERMISSIONS[action]);
}

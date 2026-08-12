import { useMemo } from 'react';

import { AccessControlAction } from 'app/types/accessControl';

import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { makeAbility } from '../abilityUtils';
import { type Ability, ExternalAlertmanagerAction } from '../types';

export function useExternalAlertmanagerAbility(action: ExternalAlertmanagerAction): Ability {
  const { hasConfigurationAPI } = useAlertmanager();
  return useMemo(() => {
    switch (action) {
      case ExternalAlertmanagerAction.ViewExternalConfiguration:
        return makeAbility(true, [AccessControlAction.AlertingNotificationsExternalRead]);
      case ExternalAlertmanagerAction.UpdateExternalConfiguration:
        return makeAbility(hasConfigurationAPI, [AccessControlAction.AlertingNotificationsExternalWrite]);
    }
  }, [action, hasConfigurationAPI]);
}

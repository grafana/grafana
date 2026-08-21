import { useWatch } from 'react-hook-form';

import { isRulesForcedSkipped } from './steps';
import { type WizardFormValues } from './types';

/** Whether the Rules step is force-skipped; uses `useWatch` so callers re-render when it changes. */
export function useIsRulesForcedSkipped(): boolean {
  const autoSyncNotificationsEnabled = useWatch<WizardFormValues, 'autoSyncNotificationsEnabled'>({
    name: 'autoSyncNotificationsEnabled',
  });
  const notificationsSource = useWatch<WizardFormValues, 'notificationsSource'>({ name: 'notificationsSource' });
  return isRulesForcedSkipped(autoSyncNotificationsEnabled ?? false, notificationsSource ?? 'yaml');
}

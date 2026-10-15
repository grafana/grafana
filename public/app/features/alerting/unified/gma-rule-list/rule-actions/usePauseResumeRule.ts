import {
  useUpdateAlertRuleMutation,
  useUpdateRecordingRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { useInvalidateFolderData } from '../folder-browsing/folderLookups';

import { trackRulePauseResume } from './analytics';

/**
 * Shared pause/resume logic between the Alert and Recording menus - only the generated mutation
 * hook differs, so this is the one piece genuinely identical between the two.
 */
async function performPauseResume(
  kind: 'alert' | 'recording',
  triggerPatch: () => Promise<unknown>,
  paused: boolean,
  invalidateFolderData: () => void
): Promise<boolean> {
  try {
    await triggerPatch();
    trackRulePauseResume(kind, 'success', paused);
    appEvents.emit(AppEvents.alertSuccess.name, [
      paused
        ? t('alerting.gma-rule-list.actions.rule-paused', 'Rule paused')
        : t('alerting.gma-rule-list.actions.rule-resumed', 'Rule resumed'),
    ]);
    invalidateFolderData();
    return true;
  } catch (error) {
    trackRulePauseResume(kind, 'error', paused);
    appEvents.emit(AppEvents.alertError.name, [
      paused
        ? t('alerting.gma-rule-list.actions.rule-pause-error', 'Failed to pause rule')
        : t('alerting.gma-rule-list.actions.rule-resume-error', 'Failed to resume rule'),
      stringifyErrorLike(error),
    ]);
    return false;
  }
}

export function useAlertRulePauseResume(uid: string) {
  const [updateAlertRule, { isLoading }] = useUpdateAlertRuleMutation();
  const invalidateFolderData = useInvalidateFolderData();

  const setPaused = (paused: boolean) =>
    performPauseResume(
      'alert',
      () => updateAlertRule({ name: uid, patch: { spec: { paused } } }).unwrap(),
      paused,
      invalidateFolderData
    );

  return { setPaused, isPending: isLoading };
}

export function useRecordingRulePauseResume(uid: string) {
  const [updateRecordingRule, { isLoading }] = useUpdateRecordingRuleMutation();
  const invalidateFolderData = useInvalidateFolderData();

  const setPaused = (paused: boolean) =>
    performPauseResume(
      'recording',
      () => updateRecordingRule({ name: uid, patch: { spec: { paused } } }).unwrap(),
      paused,
      invalidateFolderData
    );

  return { setPaused, isPending: isLoading };
}

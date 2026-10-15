import {
  useDeleteAlertRuleMutation,
  useDeleteRecordingRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { useInvalidateFolderData } from '../folder-browsing/folderLookups';

import { trackRuleDelete } from './analytics';

/** Matches the validator's rejection message so the UI can explain it instead of showing raw API text. */
const SEQUENCE_RESTRICTION_PATTERN = /belongs to rule sequence/;

export interface DeleteRuleResult {
  success: boolean;
  error?: string;
}

/** Shared between the Alert and Recording delete flows - only the generated mutation differs. */
async function performDelete(
  kind: 'alert' | 'recording',
  triggerDelete: () => Promise<unknown>,
  invalidateFolderData: () => void
): Promise<DeleteRuleResult> {
  try {
    await triggerDelete();
    trackRuleDelete(kind, 'success');
    invalidateFolderData();
    return { success: true };
  } catch (error) {
    trackRuleDelete(kind, 'error');
    const message = stringifyErrorLike(error);
    return {
      success: false,
      error: SEQUENCE_RESTRICTION_PATTERN.test(message)
        ? t(
            'alerting.gma-rule-list.actions.delete-sequence-restricted',
            'This rule belongs to a rule sequence and must be removed from it before it can be deleted.'
          )
        : message,
    };
  }
}

export function useDeleteAlertRule(uid: string) {
  const [deleteAlertRule, { isLoading }] = useDeleteAlertRuleMutation();
  const invalidateFolderData = useInvalidateFolderData();

  const deleteRule = () => performDelete('alert', () => deleteAlertRule({ name: uid }).unwrap(), invalidateFolderData);

  return { deleteRule, isPending: isLoading };
}

export function useDeleteRecordingRule(uid: string) {
  const [deleteRecordingRule, { isLoading }] = useDeleteRecordingRuleMutation();
  const invalidateFolderData = useInvalidateFolderData();

  const deleteRule = () =>
    performDelete('recording', () => deleteRecordingRule({ name: uid }).unwrap(), invalidateFolderData);

  return { deleteRule, isPending: isLoading };
}

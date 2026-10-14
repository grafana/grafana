import { useCallback } from 'react';

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
  /** Set only when the API rejected the delete because the rule is still a sequence member. */
  sequenceRestricted: boolean;
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
    return { success: true, sequenceRestricted: false };
  } catch (error) {
    trackRuleDelete(kind, 'error');
    const message = stringifyErrorLike(error);
    const sequenceRestricted = SEQUENCE_RESTRICTION_PATTERN.test(message);
    return {
      success: false,
      sequenceRestricted,
      error: sequenceRestricted
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

  const deleteRule = useCallback(
    () => performDelete('alert', () => deleteAlertRule({ name: uid }).unwrap(), invalidateFolderData),
    [deleteAlertRule, invalidateFolderData, uid]
  );

  return { deleteRule, isPending: isLoading };
}

export function useDeleteRecordingRule(uid: string) {
  const [deleteRecordingRule, { isLoading }] = useDeleteRecordingRuleMutation();
  const invalidateFolderData = useInvalidateFolderData();

  const deleteRule = useCallback(
    () => performDelete('recording', () => deleteRecordingRule({ name: uid }).unwrap(), invalidateFolderData),
    [deleteRecordingRule, invalidateFolderData, uid]
  );

  return { deleteRule, isPending: isLoading };
}

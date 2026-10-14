import { useCallback } from 'react';

import {
  useDeleteAlertRuleMutation,
  useDeleteRecordingRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { trackRuleDelete } from './analytics';
import { type OnMutated } from './ruleActionTypes';

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
  onMutated: OnMutated
): Promise<DeleteRuleResult> {
  try {
    await triggerDelete();
    trackRuleDelete(kind, 'success');
    onMutated('deleted');
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

  const deleteRule = useCallback(
    (onMutated: OnMutated) => performDelete('alert', () => deleteAlertRule({ name: uid }).unwrap(), onMutated),
    [deleteAlertRule, uid]
  );

  return { deleteRule, isPending: isLoading };
}

export function useDeleteRecordingRule(uid: string) {
  const [deleteRecordingRule, { isLoading }] = useDeleteRecordingRuleMutation();

  const deleteRule = useCallback(
    (onMutated: OnMutated) => performDelete('recording', () => deleteRecordingRule({ name: uid }).unwrap(), onMutated),
    [deleteRecordingRule, uid]
  );

  return { deleteRule, isPending: isLoading };
}

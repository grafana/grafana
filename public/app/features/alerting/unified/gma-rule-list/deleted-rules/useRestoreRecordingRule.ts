import { type RecordingRule, useCreateRecordingRuleMutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type RuleRestorer, toRestoreResult } from './deletedRulesPage';
import { sanitizeForRestore } from './useRestoreRule';

export function useRestoreRecordingRule(): RuleRestorer<RecordingRule> {
  const [createRecordingRule, { isLoading }] = useCreateRecordingRuleMutation();

  const restore = async (rule: RecordingRule) =>
    toRestoreResult(await createRecordingRule({ recordingRule: sanitizeForRestore(rule) }));

  return { restore, isRestoring: isLoading };
}

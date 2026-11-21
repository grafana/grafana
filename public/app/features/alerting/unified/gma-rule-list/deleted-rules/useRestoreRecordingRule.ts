import { type RecordingRule, useCreateRecordingRuleMutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type DeletedRule, type RestoreResult, toRestoreResult } from './deletedRulesPage';
import { sanitizeForRestore } from './useRestoreRule';

export function useRestoreRecordingRule() {
  const [createRecordingRule, { isLoading }] = useCreateRecordingRuleMutation();

  const restore = async (rule: DeletedRule): Promise<RestoreResult> => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const payload = sanitizeForRestore(rule) as RecordingRule;
    return toRestoreResult(await createRecordingRule({ recordingRule: payload }));
  };

  return { restore, isRestoring: isLoading };
}

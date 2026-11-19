import { type RecordingRule, useCreateRecordingRuleMutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isFetchError } from '@grafana/runtime';

import { type DeletedRule, type RestoreResult } from './types';
import { sanitizeForRestore } from './useRestoreRule';

export function useRestoreRecordingRule() {
  const [createRecordingRule, { isLoading }] = useCreateRecordingRuleMutation();

  const restore = async (rule: DeletedRule): Promise<RestoreResult> => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const payload = sanitizeForRestore(rule) as RecordingRule;
    const result = await createRecordingRule({ recordingRule: payload });

    if ('error' in result) {
      const isConflict = isFetchError(result.error) && result.error.status === 409;
      return { success: false, isConflict, error: result.error };
    }
    return { success: true, isConflict: false };
  };

  return { restore, isRestoring: isLoading };
}

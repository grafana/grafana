import { type AlertRule, useCreateAlertRuleMutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isFetchError } from '@grafana/runtime';

import { type DeletedRule, type RestoreResult } from './types';

const GROUP_LABELS_TO_REMOVE = new Set(['grafana.com/group', 'grafana.com/group-index']);

export function sanitizeForRestore(rule: DeletedRule): DeletedRule {
  const { resourceVersion, deletionTimestamp, managedFields, finalizers, generation, ...cleanMeta } =
    rule.metadata ?? {};

  const cleanLabels = Object.fromEntries(
    Object.entries(cleanMeta.labels ?? {}).filter(([key]) => !GROUP_LABELS_TO_REMOVE.has(key))
  );

  return {
    apiVersion: rule.apiVersion,
    kind: rule.kind,
    metadata: { ...cleanMeta, labels: cleanLabels },
    spec: rule.spec,
  };
}

export function useRestoreAlertRule() {
  const [createAlertRule, { isLoading }] = useCreateAlertRuleMutation();

  const restore = async (rule: DeletedRule): Promise<RestoreResult> => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const payload = sanitizeForRestore(rule) as AlertRule;
    const result = await createAlertRule({ alertRule: payload });

    if ('error' in result) {
      const isConflict = isFetchError(result.error) && result.error.status === 409;
      return { success: false, isConflict, error: result.error };
    }
    return { success: true, isConflict: false };
  };

  return { restore, isRestoring: isLoading };
}

import { type AlertRule, useCreateAlertRuleMutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isFetchError } from '@grafana/runtime';

const GROUP_LABELS_TO_REMOVE = new Set(['grafana.com/group', 'grafana.com/group-index']);

/**
 * Builds the create payload from a trash item, following the same pattern as
 * the dashboards restore (keep metadata + spec, clear resourceVersion).
 * Group labels are stripped because the group-free create API rejects them.
 */
export function sanitizeForRestore(rule: AlertRule): AlertRule {
  const { resourceVersion, deletionTimestamp, managedFields, finalizers, ...cleanMeta } = rule.metadata ?? {};

  const cleanLabels = Object.fromEntries(
    Object.entries(cleanMeta.labels ?? {}).filter(([key]) => !GROUP_LABELS_TO_REMOVE.has(key))
  );

  return { ...rule, metadata: { ...cleanMeta, labels: cleanLabels } };
}

interface RestoreResult {
  success: boolean;
  isConflict: boolean;
  error?: unknown;
}

export function useRestoreAlertRule() {
  const [createAlertRule, { isLoading }] = useCreateAlertRuleMutation();

  const restore = async (rule: AlertRule): Promise<RestoreResult> => {
    const payload = sanitizeForRestore(rule);
    const result = await createAlertRule({ alertRule: payload });

    if ('error' in result) {
      const isConflict = isFetchError(result.error) && result.error.status === 409;
      return { success: false, isConflict, error: result.error };
    }
    return { success: true, isConflict: false };
  };

  return { restore, isRestoring: isLoading };
}

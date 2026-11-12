import { type AlertRule, useCreateAlertRuleMutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isFetchError } from '@grafana/runtime';

const ANNOTATIONS_TO_REMOVE = new Set([
  'grafana.com/provenance',
  'grafana.app/managedBy',
  'grafana.com/group',
  'grafana.com/group-index',
]);

/** Strips server metadata and ownership before restoring a trash item. */
export function sanitizeForRestore(rule: AlertRule): AlertRule {
  const { deletionTimestamp, resourceVersion, managedFields, finalizers, ...cleanMeta } = rule.metadata ?? {};

  const cleanAnnotations = Object.fromEntries(
    Object.entries(cleanMeta.annotations ?? {}).filter(
      ([key]) => !key.startsWith('grafana.com/access/') && !ANNOTATIONS_TO_REMOVE.has(key)
    )
  );

  const cleanRule = {
    ...rule,
    metadata: { ...cleanMeta, annotations: cleanAnnotations },
  };
  Reflect.deleteProperty(cleanRule, 'status');
  return cleanRule;
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

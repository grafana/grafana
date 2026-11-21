import {
  type AlertRule,
  type ObjectMeta,
  useCreateAlertRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type DeletedRule, type RestoreResult, toRestoreResult } from './deletedRulesPage';

const GROUP_LABELS_TO_REMOVE = new Set(['grafana.com/group', 'grafana.com/group-index']);

export function sanitizeForRestore(rule: DeletedRule) {
  const { resourceVersion, deletionTimestamp, managedFields, finalizers, generation, ...cleanMeta } =
    rule.metadata ?? {};

  const cleanLabels = Object.fromEntries(
    Object.entries(cleanMeta.labels ?? {}).filter(([key]) => !GROUP_LABELS_TO_REMOVE.has(key))
  );

  // Explicitly typed so callers can access ObjectMeta fields (e.g. in tests) even though
  // the destructured fields above are removed at runtime.
  const sanitizedMeta: ObjectMeta = { ...cleanMeta, labels: cleanLabels };

  return {
    apiVersion: rule.apiVersion,
    kind: rule.kind,
    metadata: sanitizedMeta,
    spec: rule.spec,
  };
}

export function useRestoreAlertRule() {
  const [createAlertRule, { isLoading }] = useCreateAlertRuleMutation();

  const restore = async (rule: DeletedRule): Promise<RestoreResult> => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const payload = sanitizeForRestore(rule) as AlertRule;
    return toRestoreResult(await createAlertRule({ alertRule: payload }));
  };

  return { restore, isRestoring: isLoading };
}

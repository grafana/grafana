import {
  type AlertRule,
  type ObjectMeta,
  useCreateAlertRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type DeletedRule, type RuleRestorer, toRestoreResult } from './deletedRulesPage';

const GROUP_LABELS_TO_REMOVE = new Set(['grafana.com/group', 'grafana.com/group-index']);

export function sanitizeForRestore<Rule extends DeletedRule>(
  rule: Rule
): Pick<Rule, 'apiVersion' | 'kind' | 'spec'> & { metadata: ObjectMeta } {
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

export function useRestoreAlertRule(): RuleRestorer<AlertRule> {
  const [createAlertRule, { isLoading }] = useCreateAlertRuleMutation();

  const restore = async (rule: AlertRule) =>
    toRestoreResult(await createAlertRule({ alertRule: sanitizeForRestore(rule) }));

  return { restore, isRestoring: isLoading };
}

import { reportInteraction } from '@grafana/runtime';

export type RuleKind = 'alert' | 'recording';

/** Never pass filter values, titles/UIDs, labels or folder paths - only rule kind and browsing mode. */
export function trackRuleListPageView(kind: RuleKind, mode: 'list' | 'folders') {
  reportInteraction('grafana_alerting_gma_rule_list_view', { kind, mode });
}

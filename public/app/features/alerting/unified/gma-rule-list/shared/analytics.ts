import { reportInteraction } from '@grafana/runtime';

export type RuleKind = 'alert' | 'recording';

/**
 * Page-view analytics for the GMA-only Alert/Recording rule lists. Never pass filter values,
 * rule titles/UIDs, labels, or folder paths here - only the rule kind and browsing mode. The
 * old `grafana_alerting_rule_list_page_view` event only distinguishes the legacy list's V1/V2,
 * so it can't measure use of these pages - this is the new-page equivalent.
 */
export function trackRuleListPageView(kind: RuleKind, mode: 'list' | 'folders') {
  reportInteraction('grafana_alerting_gma_rule_list_view', { kind, mode });
}

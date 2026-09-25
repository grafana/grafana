import { reportInteraction } from '@grafana/runtime';

import { type RuleListMode } from '../search/useRuleListSearchState';

/**
 * Page-view analytics for the GMA-only Alert/Recording rule lists. Never pass filter values,
 * rule titles/UIDs, labels, or folder paths here - only the rule kind and browsing mode. The
 * old `grafana_alerting_rule_list_page_view` event only distinguishes the legacy list's V1/V2,
 * so it can't measure use of these pages - this is the new-page equivalent.
 */
export function trackRuleListPageView(kind: 'alert' | 'recording', mode: RuleListMode) {
  reportInteraction('grafana_alerting_gma_rule_list_view', { kind, mode });
}

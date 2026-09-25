import { reportInteraction } from '@grafana/runtime';

/**
 * Analytics for the Recently deleted (trash) pages. Never pass rule titles, UIDs, folder paths,
 * labels, annotations, or query content here - only the rule kind and coarse outcome/count/timing
 * data.
 */

export type DeletedRuleKind = 'alert' | 'recording';

export function trackDeletedRulesPageView(kind: DeletedRuleKind) {
  reportInteraction('grafana_alerting_deleted_rules_page_view', { kind });
}

export function trackDeletedRulesLoadResult(
  kind: DeletedRuleKind,
  outcome: 'success' | 'error',
  rowCount: number,
  durationMs: number
) {
  reportInteraction('grafana_alerting_deleted_rules_load_result', { kind, outcome, rowCount, durationMs });
}

export function trackDeletedRuleReviewOpened(kind: DeletedRuleKind) {
  reportInteraction('grafana_alerting_deleted_rule_review_opened', { kind });
}

export function trackDeletedRuleAdvancedJsonOpened(kind: DeletedRuleKind) {
  reportInteraction('grafana_alerting_deleted_rule_advanced_json_opened', { kind });
}

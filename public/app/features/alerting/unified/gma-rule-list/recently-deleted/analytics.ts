import { reportInteraction } from '@grafana/runtime';

import { type RuleKind } from '../shared/ruleKind';

/** Only rule kind and coarse outcome, count or timing. Never titles, UIDs, labels or queries. */

export function trackDeletedRulesPageView(kind: RuleKind) {
  reportInteraction('grafana_alerting_deleted_rules_page_view', { kind });
}

export function trackDeletedRulesLoadResult(
  kind: RuleKind,
  outcome: 'success' | 'error',
  rowCount: number,
  durationMs: number
) {
  reportInteraction('grafana_alerting_deleted_rules_load_result', { kind, outcome, rowCount, durationMs });
}

export function trackDeletedRuleReviewOpened(kind: RuleKind) {
  reportInteraction('grafana_alerting_deleted_rule_review_opened', { kind });
}

export function trackDeletedRuleAdvancedJsonOpened(kind: RuleKind) {
  reportInteraction('grafana_alerting_deleted_rule_advanced_json_opened', { kind });
}

import { reportInteraction } from '@grafana/runtime';

import { type RuleKind } from '../shared/analytics';

/**
 * Analytics for the GMA-only rule action menus and page headers. Never pass rule titles, UIDs,
 * folder paths, labels, or query content here - only the rule kind and coarse outcome.
 */

export function trackRulePauseResume(kind: RuleKind, outcome: 'success' | 'error', targetPaused: boolean) {
  reportInteraction('grafana_alerting_gma_rule_pause_resume', { kind, outcome, targetPaused });
}

export function trackRuleDelete(kind: RuleKind, outcome: 'success' | 'error') {
  reportInteraction('grafana_alerting_gma_rule_delete', { kind, outcome });
}

export function trackRuleCopyLink(kind: RuleKind, outcome: 'success' | 'error') {
  reportInteraction('grafana_alerting_gma_rule_copy_link', { kind, outcome });
}

export function trackRuleDuplicateStarted(kind: RuleKind) {
  reportInteraction('grafana_alerting_gma_rule_duplicate_started', { kind });
}

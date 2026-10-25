import { type ListAlertRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

export function buildAlertRuleSearchQuery(continueToken?: string) {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    sort: [{ field: 'title', direction: 'asc' }],
    fields: ALERT_RULE_FIELDS,
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  } satisfies ListAlertRuleSearchRulesV0Alpha1RequestBody;
}

// `state`, `health`, and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// `annotations` returns as a JSON-encoded string; `interval` is the evaluation cadence.
const ALERT_RULE_FIELDS = ['title', 'folder', 'paused', 'state', 'health', 'lastError', 'annotations', 'interval'];

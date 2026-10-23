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

// `state` and `health` are status fields: see apps/alerting/rules/kinds/alertRule.cue searchFields.
const ALERT_RULE_FIELDS = ['title', 'folder', 'paused', 'state', 'health'];

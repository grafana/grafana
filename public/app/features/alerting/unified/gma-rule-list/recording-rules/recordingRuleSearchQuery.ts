import { type ListRecordingRuleSearchRulesV0Alpha1RequestBody } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

export function buildRecordingRuleSearchQuery(continueToken?: string) {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    sort: [{ field: 'title', direction: 'asc' }],
    fields: RECORDING_RULE_FIELDS,
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  } satisfies ListRecordingRuleSearchRulesV0Alpha1RequestBody;
}

// `health` and `lastError` are status fields populated by `alerting.ruleStatusSync`.
// Recording rules have no annotations field; `interval` is the evaluation cadence.
const RECORDING_RULE_FIELDS = ['title', 'folder', 'paused', 'health', 'lastError', 'interval'];

import { useListRecordingRuleSearchRulesV0Alpha1Mutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type Criteria } from '../rule-search/criteria';

import { type RecordingRuleSearchHit, toRecordingRuleSearchHit } from './recordingRuleSearchHit';
import { buildRecordingRuleSearchQuery } from './recordingRuleSearchQuery';

export interface RecordingRuleSearchOptions {
  continueToken?: string;
  limit?: number;
}

export interface RecordingRuleSearchPage {
  hits: RecordingRuleSearchHit[];
  continueToken?: string;
}

/**
 * The single place that chooses which API endpoint serves Recording rule search; every view goes
 * through the function this returns instead of naming a generated hook.
 */
export function useRecordingRuleSearch() {
  const [triggerSearch] = useListRecordingRuleSearchRulesV0Alpha1Mutation();

  return async (criteria: Criteria, options: RecordingRuleSearchOptions = {}): Promise<RecordingRuleSearchPage> => {
    const result = await triggerSearch({
      listRecordingRuleSearchRulesV0Alpha1RequestBody: buildRecordingRuleSearchQuery(criteria, {
        continue: options.continueToken,
        limit: options.limit,
      }),
    }).unwrap();

    return {
      hits: result.items.map(toRecordingRuleSearchHit),
      continueToken: result.metadata.continue,
    };
  };
}

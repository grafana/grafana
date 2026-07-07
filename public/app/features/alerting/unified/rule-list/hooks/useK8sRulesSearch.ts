import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type GetSearchAlertRulesAlertRuleHit,
  type GetSearchRecordingRulesRecordingRuleHit,
  type GetSearchRulesApiArg,
  useLazyGetSearchRulesQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { type RulesFilter } from '../../search/rulesSearchParser';

// The generated hit types both declare `type` as `'alertrule' | 'recordingrule'` instead of a
// per-variant literal, so `RuleSearchHit` wouldn't otherwise discriminate on `type` — narrow it here.
export type AlertRuleSearchHit = Omit<GetSearchAlertRulesAlertRuleHit, 'type'> & { type: 'alertrule' };
export type RecordingRuleSearchHit = Omit<GetSearchRecordingRulesRecordingRuleHit, 'type'> & {
  type: 'recordingrule';
};
export type RuleSearchHit = AlertRuleSearchHit | RecordingRuleSearchHit;

export const DEFAULT_RULES_SEARCH_PAGE_SIZE = 24;

const RULE_TYPE_TO_SEARCH_TYPE: Record<PromRuleType, string> = {
  [PromRuleType.Alerting]: 'alertrule',
  [PromRuleType.Recording]: 'recordingrule',
};

/**
 * Maps the definition-compatible subset of `RulesFilter` to `/search` query args.
 * Datasource, state and health filters are dropped — the search endpoint is
 * definition-only and has no server-side concept of them.
 */
export function buildSearchArgs(
  filterState: RulesFilter,
  limit: number = DEFAULT_RULES_SEARCH_PAGE_SIZE
): GetSearchRulesApiArg {
  const q = [...filterState.freeFormWords, filterState.ruleName].filter(Boolean).join(' ') || undefined;

  return {
    q,
    labels: toApiArgArray(filterState.labels),
    groups: toApiArgArray(filterState.groupName ? [filterState.groupName] : []),
    type: filterState.ruleType ? RULE_TYPE_TO_SEARCH_TYPE[filterState.ruleType] : undefined,
    receiver: filterState.contactPoint ?? undefined,
    dashboardUid: filterState.dashboardUid,
    sort: 'title',
    limit: String(limit),
  };
}

function toApiArgArray(values: string[]): GetSearchRulesApiArg['labels'] {
  if (values.length === 0) {
    return undefined;
  }
  // The generated arg type declares this field as `string`, but the backend binds it from repeated
  // query params (`?labels=a&labels=b`) into `[]string` — passing an array here is correct at runtime.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return values as unknown as GetSearchRulesApiArg['labels'];
}

interface UseK8sRulesSearchResult {
  hits: RuleSearchHit[];
  isLoading: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Cursor-paginated search over the pure-k8s `rules.alerting.grafana.app` `/search` endpoint.
 * Returns raw hits — definition-only, no Prometheus DTO mapping.
 */
export function useK8sRulesSearch(
  filterState: RulesFilter,
  pageSize: number = DEFAULT_RULES_SEARCH_PAGE_SIZE
): UseK8sRulesSearchResult {
  const [fetchSearchRules] = useLazyGetSearchRulesQuery();

  const [hits, setHits] = useState<RuleSearchHit[]>([]);
  const [continueToken, setContinueToken] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const searchArgs = useMemo(() => buildSearchArgs(filterState, pageSize), [filterState, pageSize]);

  const fetchPage = useCallback(
    async (token: string | undefined, replaceHits: boolean) => {
      setIsLoading(true);
      setError(undefined);

      try {
        const response = await fetchSearchRules({ ...searchArgs, continueToken: token }).unwrap();
        // `response.items` is typed `any` upstream (the cross-kind search response schema isn't
        // discriminated in the generated client) — hits are shaped like the per-kind hit types below.
        const newHits: RuleSearchHit[] = response.items ?? [];

        setHits((previousHits) => (replaceHits ? newHits : previousHits.concat(newHits)));
        setContinueToken(response.metadata.continue);
        setHasMore(Boolean(response.metadata.continue));
      } catch (err) {
        setError(err);
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchSearchRules, searchArgs]
  );

  useEffect(() => {
    setHits([]);
    setContinueToken(undefined);
    setHasMore(true);
    fetchPage(undefined, true);
    // fetchPage already depends on searchArgs, so this effect re-runs exactly when the filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchArgs]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchPage(continueToken, false);
    }
  }, [isLoading, hasMore, continueToken, fetchPage]);

  return { hits, isLoading, error, hasMore, loadMore };
}

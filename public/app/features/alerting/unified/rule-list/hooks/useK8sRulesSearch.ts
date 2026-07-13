import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type GetSearchAlertRulesAlertRuleHit,
  type GetSearchRecordingRulesRecordingRuleHit,
  type GetSearchRulesApiArg,
  useLazyGetSearchRulesQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { logWarning } from '../../Analytics';
import { type RulesFilter } from '../../search/rulesSearchParser';
import { getDatasourceAPIUid } from '../../utils/datasource';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';

/** The `type` discriminant used by the k8s `/search` endpoint's rule hits. */
export enum GrafanaRuleType {
  Alerting = 'alertrule',
  Recording = 'recordingrule',
}

// The generated hit types both declare `type` as `'alertrule' | 'recordingrule'` instead of a
// per-variant literal, so `RuleSearchHit` wouldn't otherwise discriminate on `type` — narrow it here.
export type AlertRuleSearchHit = Omit<GetSearchAlertRulesAlertRuleHit, 'type'> & { type: GrafanaRuleType.Alerting };
export type RecordingRuleSearchHit = Omit<GetSearchRecordingRulesRecordingRuleHit, 'type'> & {
  type: GrafanaRuleType.Recording;
};
export type RuleSearchHit = AlertRuleSearchHit | RecordingRuleSearchHit;

export const DEFAULT_RULES_SEARCH_PAGE_SIZE = 24;

/**
 * `RulesFilter.ruleType` is a legacy Prometheus-domain field (shared with v1/v2) whose values are the
 * strings `'alerting'`/`'recording'`; translate it to the k8s search API's own `GrafanaRuleType`
 * vocabulary by value, without importing the legacy Prometheus enum into v3.
 */
function toGrafanaRuleType(ruleType: RulesFilter['ruleType']): GrafanaRuleType | undefined {
  switch (ruleType) {
    case 'alerting':
      return GrafanaRuleType.Alerting;
    case 'recording':
      return GrafanaRuleType.Recording;
    default:
      return undefined;
  }
}

/**
 * Maps the definition-compatible subset of `RulesFilter` to `/search` query args — every filter v3
 * offers is applied server-side. State and health filters are dropped (the search endpoint is
 * definition-only). The folder/namespace filter is not yet forwarded: `/search`'s `folders` param
 * matches folder UIDs, but `RulesFilter.namespace` holds a folder name — that resolution needs a
 * pure-k8s, uid-valued folder options source that doesn't exist yet.
 */
export function buildSearchArgs(
  filterState: RulesFilter,
  limit: number = DEFAULT_RULES_SEARCH_PAGE_SIZE
): GetSearchRulesApiArg {
  const q = [...filterState.freeFormWords, filterState.ruleName].filter(Boolean).join(' ') || undefined;

  return {
    q,
    labels: toApiArgArray(buildLabelMatchers(filterState)),
    groups: toApiArgArray(filterState.groupName ? [filterState.groupName] : []),
    type: toGrafanaRuleType(filterState.ruleType),
    receiver: filterState.contactPoint ?? undefined,
    routingTree: filterState.policy ?? undefined,
    dashboardUid: filterState.dashboardUid,
    datasourceUiDs: toApiArgArray(resolveDatasourceUids(filterState.dataSourceNames)),
    sort: 'title',
    limit: String(limit),
  };
}

/**
 * Label matchers forwarded to `/search`. The "hide plugin-provided rules" filter (`plugins: 'hide'`)
 * is really a label filter: plugin-authored rules carry the `__grafana_origin` label, so hiding them
 * is a not-exists matcher on that label — expressed server-side, not client-side.
 */
function buildLabelMatchers(filterState: RulesFilter): string[] {
  const labels = [...filterState.labels];
  if (filterState.plugins === 'hide') {
    labels.push(`!${GRAFANA_ORIGIN_LABEL}`);
  }
  return labels;
}

/**
 * The datasource filter matches rules by their *queried* datasources; `RulesFilter` stores datasource
 * names, but `/search` expects UIDs. Names that don't resolve (e.g. a since-deleted datasource) are
 * skipped rather than failing the whole search.
 */
function resolveDatasourceUids(dataSourceNames: string[]): string[] {
  return dataSourceNames.flatMap((name) => {
    try {
      return [getDatasourceAPIUid(name)];
    } catch {
      logWarning('Ignoring datasource filter value that could not be resolved to a UID', { dataSourceName: name });
      return [];
    }
  });
}

/**
 * The generated arg type declares `labels`/`groups` as a single `string`, but Grafana's `backendSrv`
 * (see `serializeParams` in `public/app/core/utils/fetch.ts`) already serializes array-valued params
 * as repeated query keys (`?labels=a&labels=b`) — which is what the backend expects (it binds them via
 * `url.Values`, i.e. `[]string`). The cast below only appeases the generated type; it changes no
 * runtime behavior.
 */
function toApiArgArray(values: string[]): GetSearchRulesApiArg['labels'] {
  if (values.length === 0) {
    return undefined;
  }
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
 * Returns raw hits — definition-only (no state/health/instances), no Prometheus DTO mapping.
 *
 * Fetches the first page on mount and whenever `filterState`/`pageSize` change, discarding any
 * previously accumulated hits. Call `loadMore()` (e.g. from a scroll sentinel) to fetch and append
 * subsequent pages using the `continueToken` returned by the previous request.
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

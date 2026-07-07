import { HttpResponse, http } from 'msw';

import {
  filterRuleSearchHits,
  sortRuleSearchHits,
} from 'app/features/alerting/unified/mocks/server/entities/k8s/ruleSearchHits';
import { type RuleSearchHit } from 'app/features/alerting/unified/rule-list/hooks/useK8sRulesSearch';

export const RULES_ALERTING_API_SERVER_BASE_URL = '/apis/rules.alerting.grafana.app/v0alpha1';

interface SearchRulesResponse {
  apiVersion: string;
  kind: string;
  metadata: { continue?: string; remainingItemCount?: number };
  items: RuleSearchHit[];
}

function paginate(hits: RuleSearchHit[], continueToken: string | null, limit: number | undefined): SearchRulesResponse {
  const startIndex = continueToken ? Number(continueToken) : 0;
  const endIndex = limit ? startIndex + limit : hits.length;
  const page = hits.slice(startIndex, endIndex);
  const nextToken = endIndex < hits.length ? String(endIndex) : undefined;

  return {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'RuleHitList',
    metadata: { continue: nextToken, remainingItemCount: nextToken ? hits.length - endIndex : undefined },
    items: page,
  };
}

/**
 * Serves `hits` from the cross-kind `/search` endpoint, reimplementing the filter/sort/pagination
 * semantics of pkg/registry/apps/alerting/rules/search/{search,query}.go so tests exercise the same
 * query behavior the real backend has.
 */
export function rulesSearchHandlerFor(hits: RuleSearchHit[]) {
  return http.get(`${RULES_ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/search`, ({ request }) => {
    const { searchParams } = new URL(request.url);
    const continueToken = searchParams.get('continueToken');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    const filtered = filterRuleSearchHits(hits, {
      q: searchParams.get('q') ?? undefined,
      labels: searchParams.getAll('labels'),
      groups: searchParams.getAll('groups'),
      folders: searchParams.getAll('folders'),
      names: searchParams.getAll('names'),
      datasourceUIDs: searchParams.getAll('datasourceUIDs'),
      type: searchParams.get('type') ?? undefined,
      paused: searchParams.get('paused') ?? undefined,
      dashboardUID: searchParams.get('dashboardUID') ?? undefined,
      receiver: searchParams.get('receiver') ?? undefined,
      notificationType: searchParams.get('notificationType') ?? undefined,
      routingTree: searchParams.get('routingTree') ?? undefined,
      metric: searchParams.get('metric') ?? undefined,
      targetDatasourceUID: searchParams.get('targetDatasourceUID') ?? undefined,
    });
    const sorted = sortRuleSearchHits(filtered, searchParams.get('sort') ?? undefined);

    return HttpResponse.json(paginate(sorted, continueToken, limit));
  });
}

const handlers = [rulesSearchHandlerFor([])];

export default handlers;

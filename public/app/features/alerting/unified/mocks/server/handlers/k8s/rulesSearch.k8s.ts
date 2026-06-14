import { HttpResponse, http } from 'msw';

const SEARCH_BASE_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/search';

/**
 * Hits served by the mock `/search` endpoint. Tests set these via {@link setSearchRules};
 * default is empty so the search-backed Grafana branch contributes no rows.
 */
let searchHits: unknown[] = [];

export function setSearchRules(hits: unknown[]) {
  searchHits = hits;
}

export function resetSearchRules() {
  searchHits = [];
}

/**
 * Offset-paginated response mirroring the real endpoint: `limit` slices the list and
 * `metadata.continue` carries the next offset until the list is exhausted.
 */
function searchResponse(url: URL) {
  const limit = Number(url.searchParams.get('limit')) || 100;
  const offset = Number(url.searchParams.get('continueToken')) || 0;

  const page = searchHits.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < searchHits.length;

  return HttpResponse.json({
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'RuleSearchResults',
    metadata: { continue: hasMore ? String(nextOffset) : undefined },
    items: page,
  });
}

const handlers = [
  http.get(SEARCH_BASE_URL, ({ request }) => searchResponse(new URL(request.url))),
  http.get(`${SEARCH_BASE_URL}/alertrules`, ({ request }) => searchResponse(new URL(request.url))),
  http.get(`${SEARCH_BASE_URL}/recordingrules`, ({ request }) => searchResponse(new URL(request.url))),
];

export default handlers;

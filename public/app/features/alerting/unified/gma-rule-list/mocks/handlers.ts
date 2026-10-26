import { HttpResponse, http } from 'msw';

import { getAPIBaseURL } from '@grafana/api-clients';
import server from '@grafana/test-utils/server';

import { type RuleKind } from '../shared/ruleKind';

const RULES_BASE = getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1');
const FOLDERS_BASE = getAPIBaseURL('folder.grafana.app', 'v1beta1');

export const FOLDER_SEARCH_URL = `${FOLDERS_BASE}/folders/search`;
export const FOLDER_PARENTS_URL = `${FOLDERS_BASE}/folders/:name/parents`;
export const FOLDER_COUNTS_URL = `${FOLDERS_BASE}/folders/:name/counts`;

export function ruleSearchUrl(kind: RuleKind) {
  return `${RULES_BASE}/${kind === 'alert' ? 'searchAlertRules' : 'searchRecordingRules'}`;
}

export interface SearchRequestBody {
  where?: { filter?: { values?: string[] }; and?: unknown[] };
  continue?: string;
}

/** Answers every rule search of this kind; `respond` gets the request body and a 1-based call number. */
export function mockRuleSearch(kind: RuleKind, respond: (body: SearchRequestBody, call: number) => object) {
  let call = 0;
  server.use(
    http.post(ruleSearchUrl(kind), async ({ request }) => {
      call += 1;
      return HttpResponse.json(respond((await request.json()) as SearchRequestBody, call));
    })
  );
}

/** Answers every folder search; `respond` gets the request body and a 1-based call number. */
export function mockFolderSearch(respond: (body: SearchRequestBody, call: number) => object) {
  let call = 0;
  server.use(
    http.post(FOLDER_SEARCH_URL, async ({ request }) => {
      call += 1;
      return HttpResponse.json(respond((await request.json()) as SearchRequestBody, call));
    })
  );
}

/** Fails the first request to `url` with a 500, then answers with `ok`; returns a request counter. */
export function failFirstCall(method: 'get' | 'post', url: string, ok: object) {
  let calls = 0;
  server.use(
    http[method](url, () => {
      calls += 1;
      return calls === 1 ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : HttpResponse.json(ok);
    })
  );
  return () => calls;
}

/** A string is the folder's own title; an array is its path, outermost first, ending with the folder itself. */
export function mockFolderParents(pathByUid: Record<string, string | string[]>) {
  server.use(
    http.get(FOLDER_PARENTS_URL, ({ params }) => {
      const name = params.name as string;
      const path = [pathByUid[name] ?? name].flat();
      return HttpResponse.json({
        items: path.map((title, index) => ({
          name: index === path.length - 1 ? name : `${name}-parent-${index}`,
          title,
        })),
      });
    })
  );
}

export function mockFolderCounts(kind: RuleKind, countByUid: Record<string, number>) {
  server.use(
    http.get(FOLDER_COUNTS_URL, ({ params }) =>
      HttpResponse.json({
        counts: [
          {
            resource: kind === 'alert' ? 'alertrules' : 'recordingrules',
            group: 'rules.alerting.grafana.app',
            count: countByUid[params.name as string] ?? 0,
          },
        ],
      })
    )
  );
}

export { mockK8sAlertRule, getAlertRuleHandler } from '../../mocks/server/handlers/k8s/alertRules.k8s';
export { getRecordingRuleHandler } from '../../mocks/server/handlers/k8s/recordingrules.k8s';

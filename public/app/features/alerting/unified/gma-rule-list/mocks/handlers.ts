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

interface SearchRequestBody {
  where?: unknown;
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

/** Fails the first POST to `url` with a 500, then answers with `ok`; returns a request counter. */
export function failFirstCall(url: string, ok: object) {
  let calls = 0;
  server.use(
    http.post(url, () => {
      calls += 1;
      return calls === 1 ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : HttpResponse.json(ok);
    })
  );
  return () => calls;
}

export function mockFolderParents(titleByUid: Record<string, string>) {
  server.use(
    http.get(FOLDER_PARENTS_URL, ({ params }) => {
      const name = params.name as string;
      return HttpResponse.json({ items: [{ name, title: titleByUid[name] ?? name }] });
    })
  );
}

export { mockK8sAlertRule, getAlertRuleHandler } from '../../mocks/server/handlers/k8s/alertRules.k8s';
export { getRecordingRuleHandler } from '../../mocks/server/handlers/k8s/recordingrules.k8s';

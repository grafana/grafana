import { HttpResponse, http } from 'msw';

import { getAPIBaseURL } from '@grafana/api-clients';
import server from '@grafana/test-utils/server';

import { type RuleKind } from '../shared/ruleKind';

const RULES_BASE = getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1');
const FOLDERS_BASE = getAPIBaseURL('folder.grafana.app', 'v1beta1');

const RULES_PATH: Record<RuleKind, string> = { alert: 'alertrules', recording: 'recordingrules' };

export const FOLDER_SEARCH_URL = `${FOLDERS_BASE}/folders/search`;
export const FOLDER_PARENTS_URL = `${FOLDERS_BASE}/folders/:name/parents`;
export const FOLDER_COUNTS_URL = `${FOLDERS_BASE}/folders/:name/counts`;

export function rulesUrl(kind: RuleKind) {
  return `${RULES_BASE}/${RULES_PATH[kind]}`;
}

export function ruleSearchUrl(kind: RuleKind) {
  return `${RULES_BASE}/${kind === 'alert' ? 'searchAlertRules' : 'searchRecordingRules'}`;
}

export function ruleUrl(kind: RuleKind) {
  return `${rulesUrl(kind)}/:name`;
}

export interface SearchRequestBody {
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

export function mockFolderSearch(respond: (body: SearchRequestBody, call: number) => object) {
  let call = 0;
  server.use(
    http.post(FOLDER_SEARCH_URL, async ({ request }) => {
      call += 1;
      return HttpResponse.json(respond((await request.json()) as SearchRequestBody, call));
    })
  );
}

export function mockFolderParents(titleByUid: Record<string, string>) {
  server.use(
    http.get(FOLDER_PARENTS_URL, ({ params }) => {
      const name = params.name as string;
      return HttpResponse.json({ items: [{ name, title: titleByUid[name] ?? name }] });
    })
  );
}

export function mockFolderCounts(kind: RuleKind, countByUid: Record<string, number>) {
  server.use(
    http.get(FOLDER_COUNTS_URL, ({ params }) =>
      HttpResponse.json({
        counts: [
          {
            resource: RULES_PATH[kind],
            group: 'rules.alerting.grafana.app',
            count: countByUid[params.name as string] ?? 0,
          },
        ],
      })
    )
  );
}

/** Answers the full-rule GET behind row actions; returns the request counter. */
export function mockFullRule(kind: RuleKind, annotations: Record<string, string> = {}) {
  const requests = { count: 0 };
  server.use(
    http.get(ruleUrl(kind), ({ params }) => {
      requests.count += 1;
      return HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: kind === 'alert' ? 'AlertRule' : 'RecordingRule',
        metadata: { name: params.name, annotations },
        spec: { title: 'rule', paused: false },
      });
    })
  );
  return requests;
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

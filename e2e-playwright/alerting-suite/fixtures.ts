import { type APIRequestContext, type APIResponse } from '@playwright/test';

import { test as base, expect } from '@grafana/plugin-e2e';

// "empty" is the default contact point Grafana provisions on a fresh dev install.
export const contactPoint = 'empty';
export const dataSource = 'gdev-testdata';

// POST that retries a transient failure with Playwright's built-in expect(...).toPass. At the worker
// startup burst the write (or its folders:read authz check) can lose the SQLITE_BUSY race against the
// e2e server's small SQLite connection pool and return a transient 403/500. Default timeout is bounded
// so a genuine failure still surfaces quickly with its status/body; the folder-create call below passes
// a longer one since a single attempt can itself take as long as the server's `busy_timeout` (7.5s).
async function postWithRetry(
  request: APIRequestContext,
  url: string,
  data: unknown,
  timeout = 5000
): Promise<APIResponse> {
  let response: APIResponse | undefined;
  await expect(async () => {
    response = await request.post(url, { data });
    expect(response.ok(), `POST ${url} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  }).toPass({ intervals: [200, 500, 1000, 2000], timeout });
  // toPass only resolves once the callback passed, so response is set; the guard narrows the type.
  if (!response) {
    throw new Error(`POST ${url} produced no response`);
  }
  return response;
}

type WorkerApi = {
  request: APIRequestContext;
  namespace: string;
};

type Folder = {
  uid: string;
  title: string;
};

// Disposable rule fixture: every group/rule a test creates is tracked and deleted (LIFO) at test end.
class AlertRulesFixture {
  private readonly disposers: Array<() => Promise<void>> = [];

  constructor(
    private readonly request: APIRequestContext,
    private readonly api: WorkerApi,
    private readonly folder: Folder
  ) {}

  // Seed a named evaluation group via the ruler API (the only API with named groups). A group needs
  // at least one rule; we use a paused constant `math` expression so seeding does no datasource or
  // scheduler work — only the group name + interval matter to the tests that pick it.
  async seedGroup(groupName: string, interval: string, ruleTitle: string): Promise<void> {
    await postWithRetry(
      this.request,
      `/api/ruler/grafana/api/v1/rules/${this.folder.uid}`,
      {
        name: groupName,
        interval,
        rules: [
          {
            for: '0s',
            annotations: {},
            labels: {},
            grafana_alert: {
              title: ruleTitle,
              condition: 'A',
              no_data_state: 'NoData',
              exec_err_state: 'Error',
              is_paused: true,
              data: [
                {
                  refId: 'A',
                  datasourceUid: '__expr__',
                  queryType: '',
                  relativeTimeRange: { from: 600, to: 0 },
                  model: { refId: 'A', type: 'math', expression: '1 == 1' },
                },
              ],
            },
          },
        ],
      },
      15_000
    );
    this.disposers.push(async () => {
      await this.request.delete(`/api/ruler/grafana/api/v1/rules/${this.folder.uid}/${encodeURIComponent(groupName)}`);
    });
  }

  // Seed a single Grafana-managed rule via the k8s alertrule API (independent of the UI form).
  // Returns the rule UID. Paused constant math expression — see seedGroup.
  async seedRule({ title, interval }: { title: string; interval: string }): Promise<string> {
    const response = await postWithRetry(
      this.request,
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${this.api.namespace}/alertrules`,
      {
        apiVersion: 'rules.alerting.grafana.app/v0alpha1',
        kind: 'AlertRule',
        metadata: { annotations: { 'grafana.app/folder': this.folder.uid } },
        spec: {
          title,
          trigger: { interval },
          noDataState: 'NoData',
          execErrState: 'Error',
          paused: true,
          notificationSettings: { type: 'SimplifiedRouting', receiver: contactPoint },
          expressions: {
            A: {
              model: { refId: 'A', type: 'math', expression: '1 == 1' },
              datasourceUID: '__expr__',
              queryType: '',
              source: true,
            },
          },
        },
      }
    );
    const uid = (await response.json()).metadata.name;
    this.trackRule(uid);
    return uid;
  }

  // Register a rule for deletion on teardown. Used by seedRule and by tests for UI-created rules.
  trackRule(uid: string): void {
    this.disposers.push(async () => {
      await this.request.delete(
        `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${this.api.namespace}/alertrules/${encodeURIComponent(uid)}`
      );
    });
  }

  // LIFO, best-effort: a resource may already be gone, and the worker folder delete is the backstop.
  async dispose(): Promise<void> {
    for (const disposer of this.disposers.reverse()) {
      try {
        await disposer();
      } catch {
        // best-effort cleanup
      }
    }
  }
}

export const test = base.extend<
  { folder: Folder; alertRules: AlertRulesFixture },
  { workerApi: WorkerApi; workerFolder: Folder }
>({
  // Worker-scoped authenticated API context + namespace lookup, built from the project's saved auth
  // state (the built-in request/namespace fixtures are test-scoped). Seeds run against the built-in
  // __expr__ engine, so no datasource lookup is needed.
  workerApi: [
    async ({ playwright }, use, workerInfo) => {
      const { baseURL, storageState } = workerInfo.project.use;
      const request = await playwright.request.newContext({ baseURL, storageState });
      const settings = await (await request.get('/api/frontend/settings')).json();
      await use({ request, namespace: settings.namespace ?? 'default' });
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  // One folder per worker, reused across its tests. A per-invocation unique name avoids cross-worker
  // collisions and orphan accumulation. Reusing it (vs. one per test) keeps folder writes — the main
  // SQLITE_BUSY contention source — to one per worker. Created via the App Platform (k8s) folders API.
  //
  // All workers create their folder at the same instant, so this single request can itself stall for
  // as long as the server's SQLite `busy_timeout` (7.5s, scripts/grafana-server/custom.ini) before it
  // resolves. A 15s retry budget (default is 5s) gives it room to survive that instead of giving up
  // before the server has even finished stalling on the first attempt. `timeout: 20_000` on the fixture
  // itself raises Playwright's own fixture-setup ceiling (normally the 10s test timeout) to match.
  workerFolder: [
    async ({ workerApi }, use, workerInfo) => {
      const suffix = crypto.randomUUID().slice(0, 8);
      const uid = `e2e-alerting-w${workerInfo.workerIndex}-${suffix}`;
      const title = `Infrastructure alerts w${workerInfo.workerIndex} ${suffix}`;
      await postWithRetry(
        workerApi.request,
        `/apis/folder.grafana.app/v1/namespaces/${workerApi.namespace}/folders`,
        {
          apiVersion: 'folder.grafana.app/v1',
          kind: 'Folder',
          metadata: { name: uid },
          spec: { title },
        },
        15_000
      );

      // The create above only guarantees the folder is durably written, not that it's visible yet:
      // every read (including the ruler API's namespace lookup that seedGroup/seedRule depend on)
      // is served off a search index that's updated asynchronously from the write. A folder that
      // exists but isn't indexed yet reads back as zero results, which callers can't distinguish
      // from "doesn't exist" — surfacing as a transient 403 on the very next request. List (not a
      // per-uid Get, which reads the primary store directly and would race past this) is what
      // actually exercises that index, so poll it until the new folder shows up.
      await expect(async () => {
        const res = await workerApi.request.get(
          `/apis/folder.grafana.app/v1/namespaces/${workerApi.namespace}/folders?fieldSelector=metadata.name%3D${uid}`
        );
        expect(res.ok(), `GET folders?fieldSelector=metadata.name=${uid} -> ${res.status()}`).toBeTruthy();
        const body = await res.json();
        expect(body.items?.length > 0, `folder ${uid} not yet visible in list`).toBeTruthy();
      }).toPass({ intervals: [50, 100, 200, 400], timeout: 15_000 });

      await use({ uid, title });

      // Per-test disposers already removed the rules/groups, so a plain delete normally suffices;
      // fall back to the cascade only if a test left something behind.
      const deleted = await workerApi.request.delete(`/api/folders/${uid}`);
      if (!deleted.ok()) {
        await workerApi.request.delete(`/api/folders/${uid}?forceDeleteRules=true`);
      }
    },
    { scope: 'worker', timeout: 35_000 },
  ],

  folder: [
    async ({ workerFolder }, use) => {
      await use(workerFolder);
    },
    { scope: 'test' },
  ],

  // Not `auto`: only tests that create rules inject it, and its teardown disposes whatever they made.
  alertRules: [
    async ({ request, workerApi, folder }, use) => {
      const fixture = new AlertRulesFixture(request, workerApi, folder);
      await use(fixture);
      await fixture.dispose();
    },
    { scope: 'test' },
  ],
});

// Rule UID is the path segment between `/alerting/grafana/` and `/view`.
export function ruleUidFromUrl(url: string): string {
  const match = url.match(/\/alerting\/grafana\/([^/]+)\/view/);
  if (!match) {
    throw new Error(`Could not extract rule UID from URL: ${url}`);
  }
  return match[1];
}

export { expect };

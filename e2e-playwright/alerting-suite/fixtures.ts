import { type APIRequestContext } from '@playwright/test';

import { test as base, expect } from '@grafana/plugin-e2e';

// "empty" is the default contact point Grafana provisions on a fresh dev install.
export const contactPoint = 'empty';
export const dataSource = 'gdev-testdata';

type WorkerApi = {
  request: APIRequestContext;
  namespace: string;
  dataSourceUid: string;
};

type Folder = {
  uid: string;
  title: string;
};

// Disposable rule fixture: every rule/group created through it is tracked and torn down
// (LIFO) when the test ends. Disposers match the create path — ruler-seeded groups via the
// ruler API, k8s-seeded and UI-created rules via the k8s alertrules API — so cleanup is
// targeted rather than a folder-wide cascade delete.
class AlertRulesFixture {
  private readonly disposers: Array<() => Promise<void>> = [];

  constructor(
    private readonly request: APIRequestContext,
    private readonly api: WorkerApi,
    private readonly folder: Folder
  ) {}

  // Seed a Grafana-managed evaluation group via the ruler API. Each group must contain at
  // least one rule — we include a minimal placeholder. Named evaluation groups only exist in
  // the ruler API (the k8s AlertRule spec has no group field), so the group picker is seeded here.
  // Reference rule shape: public/app/features/alerting/unified/mocks/grafanaRulerApi.ts:33-73.
  async seedGroup(groupName: string, interval: string, ruleTitle: string): Promise<void> {
    const response = await this.request.post(`/api/ruler/grafana/api/v1/rules/${this.folder.uid}`, {
      data: {
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
              data: [
                {
                  refId: 'A',
                  datasourceUid: this.api.dataSourceUid,
                  queryType: '',
                  relativeTimeRange: { from: 600, to: 0 },
                  model: {
                    refId: 'A',
                    scenarioId: 'random_walk',
                    datasource: { type: 'grafana-testdata-datasource', uid: this.api.dataSourceUid },
                  },
                },
              ],
            },
          },
        ],
      },
    });
    if (!response.ok()) {
      throw new Error(`Failed to seed rule group: ${response.status()} ${await response.text()}`);
    }
    this.disposers.push(async () => {
      await this.request.delete(`/api/ruler/grafana/api/v1/rules/${this.folder.uid}/${encodeURIComponent(groupName)}`);
    });
  }

  // Seed a single Grafana-managed rule via the k8s-style alertrule API (independent of the UI
  // create form). Returns the rule UID (metadata.name), already tracked for disposal.
  async seedRule({ title, interval }: { title: string; interval: string }): Promise<string> {
    const response = await this.request.post(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${this.api.namespace}/alertrules`,
      {
        data: {
          apiVersion: 'rules.alerting.grafana.app/v0alpha1',
          kind: 'AlertRule',
          metadata: { annotations: { 'grafana.app/folder': this.folder.uid } },
          spec: {
            title,
            trigger: { interval },
            noDataState: 'NoData',
            execErrState: 'Error',
            notificationSettings: { type: 'SimplifiedRouting', receiver: contactPoint },
            expressions: {
              A: {
                model: {
                  datasource: { type: 'grafana-testdata-datasource', uid: this.api.dataSourceUid },
                  refId: 'A',
                  scenarioId: 'random_walk',
                },
                datasourceUID: this.api.dataSourceUid,
                queryType: '',
                relativeTimeRange: { from: '10m', to: '0' },
                source: false,
              },
              B: {
                model: { type: 'reduce', reducer: 'last', expression: 'A', refId: 'B' },
                datasourceUID: '__expr__',
                queryType: '',
                source: false,
              },
              C: {
                model: {
                  type: 'threshold',
                  expression: 'B',
                  conditions: [{ evaluator: { type: 'gt', params: [0] } }],
                  refId: 'C',
                },
                datasourceUID: '__expr__',
                queryType: '',
                source: true,
              },
            },
          },
        },
      }
    );
    expect(response.ok()).toBeTruthy();
    const uid = (await response.json()).metadata.name;
    this.trackRule(uid);
    return uid;
  }

  // Register a rule for k8s DELETE on teardown. Used internally by seedRule and by tests to
  // dispose rules created through the UI save flow (UID parsed from the post-save URL).
  trackRule(uid: string): void {
    this.disposers.push(async () => {
      await this.request.delete(
        `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${this.api.namespace}/alertrules/${encodeURIComponent(uid)}`
      );
    });
  }

  // Run disposers in reverse registration order. A resource may already be gone (a UI rule
  // and the seed group it joined both clean the same group), so failures are non-fatal.
  async dispose(): Promise<void> {
    for (const disposer of this.disposers.reverse()) {
      try {
        await disposer();
      } catch {
        // best-effort cleanup; the worker folder delete is the final backstop
      }
    }
  }
}

export const test = base.extend<
  { folder: Folder; alertRules: AlertRulesFixture },
  { workerApi: WorkerApi; workerFolder: Folder }
>({
  // Worker-scoped authenticated API context plus one-time lookups (namespace, datasource UID).
  // The built-in request/namespace/grafanaAPIClient fixtures are test-scoped, so a worker
  // fixture must build its own context from the project's saved auth state.
  workerApi: [
    async ({ playwright }, use, workerInfo) => {
      const { baseURL, storageState } = workerInfo.project.use;
      const request = await playwright.request.newContext({ baseURL, storageState });

      const settings = await (await request.get('/api/frontend/settings')).json();
      // The ruler API needs the datasource UID, not its name — the UI form resolves this via
      // the datasource picker. Mirror that lookup so seeds work regardless of how the dev env
      // provisions the gdev datasources.
      const ds = await (await request.get(`/api/datasources/name/${encodeURIComponent(dataSource)}`)).json();

      await use({ request, namespace: settings.namespace ?? 'default', dataSourceUid: ds.uid });
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  // One folder per worker, reused across all its tests. A per-invocation unique title keeps
  // parallel workers from colliding and prevents orphans from crashed runs accumulating.
  // Reusing the folder (instead of recreating it per test) avoids the folder create/delete
  // churn that drives SQLITE_BUSY contention on the apiserver storage.
  workerFolder: [
    async ({ workerApi }, use, workerInfo) => {
      const title = `Infrastructure alerts w${workerInfo.workerIndex} ${crypto.randomUUID().slice(0, 8)}`;
      const response = await workerApi.request.post('/api/folders', { data: { title } });
      expect(response.ok()).toBeTruthy();
      const { uid } = await response.json();

      await use({ uid, title });

      await workerApi.request.delete(`/api/folders/${uid}?forceDeleteRules=true`);
    },
    { scope: 'worker' },
  ],

  folder: [
    async ({ workerFolder }, use) => {
      await use(workerFolder);
    },
    { scope: 'test' },
  ],

  // Not `auto`: only tests that create rules inject it, and its teardown disposes whatever
  // they made.
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

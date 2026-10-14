import { type APIRequestContext } from '@playwright/test';

import { test as base, expect } from '@grafana/plugin-e2e';

import {
  type AlertRuleSeed,
  type RecordingRuleSeed,
  type RuleKind,
  createAlertRule,
  createContactPoint,
  createDashboard,
  createFolderAndWait,
  createRecordingRule,
  createRoutingTree,
  deleteFolder,
  postWithRetry,
  rulesApiBase,
} from './ruleSeeding';

export { contactPoint, postWithRetry, recordingTargetDataSource } from './ruleSeeding';
export type { Page } from '@playwright/test';

export const dataSource = 'gdev-testdata';

type WorkerApi = {
  request: APIRequestContext;
  namespace: string;
};

type Folder = {
  uid: string;
  title: string;
};

// A write is durable as soon as the POST resolves, but the rule search may read an index that
// updates asynchronously — the same visibility gap `workerFolder` already works around for the
// folders list. Poll the per-kind searchRules endpoint the UI reads, filtered to one folder, until
// the expected count appears, instead of a fixed sleep or trusting the write response alone.
export async function waitForRuleSearchVisible(
  request: APIRequestContext,
  namespace: string,
  kind: RuleKind,
  folderUid: string,
  expectedCount: number,
  timeout = 20_000
): Promise<void> {
  await expect(async () => {
    const res = await request.post(`${rulesApiBase(namespace)}/${kind}/searchRules`, {
      data: {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { filter: { field: 'folder', operator: 'In', values: [folderUid] } },
        sort: [{ field: 'title', direction: 'asc' }],
        fields: ['title'],
        limit: 1,
      },
    });
    expect(res.ok(), `POST ${kind}/searchRules -> ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(
      body.metadata?.totalHits,
      `expected ${expectedCount} ${kind} visible in folder ${folderUid}, search reports ${body.metadata?.totalHits}`
    ).toBe(expectedCount);
  }).toPass({ intervals: [200, 500, 1000, 2000], timeout });
}

// Everything a test creates is tracked and deleted (LIFO) at test end, so a resource that others
// depend on (a folder, a contact point) goes away after the rules that use it.
class DisposableFixture {
  protected readonly disposers: Array<() => Promise<void>> = [];

  constructor(
    protected readonly request: APIRequestContext,
    protected readonly api: WorkerApi,
    protected readonly folder: Folder
  ) {}

  // A second folder for tests that need a rule outside the worker's folder, e.g. to prove a folder
  // filter excludes it.
  async createFolder(title: string): Promise<Folder> {
    const uid = `e2e-alerting-extra-${crypto.randomUUID().slice(0, 8)}`;
    await createFolderAndWait(this.request, this.api.namespace, uid, title);
    this.disposers.push(() => deleteFolder(this.request, uid));
    return { uid, title };
  }

  // Register a rule for deletion on teardown. Used by seedRule and by tests for UI-created rules.
  trackRule(uid: string): void {
    this.disposers.push(async () => {
      await this.request.delete(`${rulesApiBase(this.api.namespace)}/${this.ruleKind}/${encodeURIComponent(uid)}`);
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

  protected get ruleKind(): RuleKind {
    throw new Error('ruleKind must be provided by the concrete fixture');
  }
}

// Disposable rule fixture: every group/rule a test creates is tracked and deleted (LIFO) at test end.
class AlertRulesFixture extends DisposableFixture {
  protected get ruleKind(): RuleKind {
    return 'alertrules';
  }

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
  // Returns the rule UID. Paused constant math expression unless the seed says otherwise — see seedGroup.
  async seedRule(seed: AlertRuleSeed): Promise<string> {
    const uid = await createAlertRule(this.request, this.api.namespace, this.folder.uid, seed);
    this.trackRule(uid);
    return uid;
  }

  async createContactPoint(name: string): Promise<void> {
    const uid = await createContactPoint(this.request, name);
    this.disposers.push(async () => {
      await this.request.delete(`/api/v1/provisioning/contact-points/${encodeURIComponent(uid)}`);
    });
  }

  async createRoutingTree(name: string): Promise<void> {
    await createRoutingTree(this.request, this.api.namespace, name);
    this.disposers.push(async () => {
      await this.request.delete(
        `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/${this.api.namespace}/routingtrees/${encodeURIComponent(name)}`
      );
    });
  }

  async createDashboard(title: string, panelIds: number[]): Promise<string> {
    const uid = `e2e-dash-${crypto.randomUUID().slice(0, 8)}`;
    await createDashboard(this.request, uid, title, panelIds);
    this.disposers.push(async () => {
      await this.request.delete(`/api/dashboards/uid/${encodeURIComponent(uid)}`);
    });
    return uid;
  }
}

// Disposable Recording rule fixture, mirroring AlertRulesFixture — no Ruler/group API exists
// for Recording rules, so every rule is created and torn down directly through the k8s API.
class RecordingRulesFixture extends DisposableFixture {
  protected get ruleKind(): RuleKind {
    return 'recordingrules';
  }

  // Seed a single Recording rule via the k8s recordingrule API. Paused constant math
  // expression unless the seed says otherwise, same reasoning as AlertRulesFixture.seedRule:
  // no datasource/scheduler work.
  async seedRule(seed: RecordingRuleSeed): Promise<string> {
    const uid = await createRecordingRule(this.request, this.api.namespace, this.folder.uid, seed);
    this.trackRule(uid);
    return uid;
  }
}

export const test = base.extend<
  { folder: Folder; alertRules: AlertRulesFixture; recordingRules: RecordingRulesFixture },
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
  // `timeout: 35_000` on the fixture itself raises Playwright's own fixture-setup ceiling (normally
  // the 10s test timeout) to cover the 15s retry budget and the visibility poll in createFolderAndWait.
  workerFolder: [
    async ({ workerApi }, use, workerInfo) => {
      const suffix = crypto.randomUUID().slice(0, 8);
      const uid = `e2e-alerting-w${workerInfo.workerIndex}-${suffix}`;
      const title = `Infrastructure alerts w${workerInfo.workerIndex} ${suffix}`;
      await createFolderAndWait(workerApi.request, workerApi.namespace, uid, title);

      await use({ uid, title });

      // Per-test disposers already removed the rules/groups, so a plain delete normally suffices;
      // fall back to the cascade only if a test left something behind.
      await deleteFolder(workerApi.request, uid);
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

  recordingRules: [
    async ({ request, workerApi, folder }, use) => {
      const fixture = new RecordingRulesFixture(request, workerApi, folder);
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

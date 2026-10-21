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
  ruleSearchUrl,
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

// Search index lags writes; poll the kind's search for one folder until the expected count appears.
export async function waitForRuleSearchVisible(
  request: APIRequestContext,
  namespace: string,
  kind: RuleKind,
  folderUid: string,
  expectedCount: number,
  timeout = 20_000
): Promise<void> {
  await expect(async () => {
    const res = await request.post(ruleSearchUrl(namespace, kind), {
      data: {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { filter: { field: 'folder', operator: 'In', values: [folderUid] } },
        sort: [{ field: 'title', direction: 'asc' }],
        fields: ['title'],
        limit: 1,
      },
    });
    expect(res.ok(), `POST ${ruleSearchUrl(namespace, kind)} -> ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(
      body.metadata?.totalHits,
      `expected ${expectedCount} ${kind} visible in folder ${folderUid}, search reports ${body.metadata?.totalHits}`
    ).toBe(expectedCount);
  }).toPass({ intervals: [200, 500, 1000, 2000], timeout });
}

// Deleted LIFO so a folder or contact point outlives the rules using it.
class DisposableFixture {
  protected readonly disposers: Array<() => Promise<void>> = [];

  constructor(
    protected readonly request: APIRequestContext,
    protected readonly api: WorkerApi,
    protected readonly folder: Folder
  ) {}

  async createFolder(title: string): Promise<Folder> {
    const uid = `e2e-alerting-extra-${crypto.randomUUID().slice(0, 8)}`;
    await createFolderAndWait(this.request, this.api.namespace, uid, title);
    this.disposers.push(() => deleteFolder(this.request, uid));
    return { uid, title };
  }

  trackRule(uid: string): void {
    this.disposers.push(async () => {
      await this.request.delete(`${rulesApiBase(this.api.namespace)}/${this.ruleKind}/${encodeURIComponent(uid)}`);
    });
  }

  // Best-effort: a resource may be gone; the worker folder delete is the backstop.
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

class AlertRulesFixture extends DisposableFixture {
  protected get ruleKind(): RuleKind {
    return 'alertrules';
  }

  // Ruler API is the only one with named groups; paused `math` rule avoids datasource work.
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

  // Paused constant math expression unless the seed says otherwise.
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

// No Ruler API for Recording rules; use the k8s API.
class RecordingRulesFixture extends DisposableFixture {
  protected get ruleKind(): RuleKind {
    return 'recordingrules';
  }

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
  // Worker-scoped, since built-in fixtures are test-scoped.
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

  // One folder per worker limits folder writes (SQLITE_BUSY); the timeout covers the retry plus visibility poll.
  workerFolder: [
    async ({ workerApi }, use, workerInfo) => {
      const suffix = crypto.randomUUID().slice(0, 8);
      const uid = `e2e-alerting-w${workerInfo.workerIndex}-${suffix}`;
      const title = `Infrastructure alerts w${workerInfo.workerIndex} ${suffix}`;
      await createFolderAndWait(workerApi.request, workerApi.namespace, uid, title);

      await use({ uid, title });

      // Cascade only if a test left something behind.
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

export function ruleUidFromUrl(url: string): string {
  const match = url.match(/\/alerting\/grafana\/([^/]+)\/view/);
  if (!match) {
    throw new Error(`Could not extract rule UID from URL: ${url}`);
  }
  return match[1];
}

export { expect };

import { type APIRequestContext, type BrowserContext, type PlaywrightWorkerArgs } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

import { getNamespace, newAdminRequest, recordingTargetDataSource } from './ruleSeeding';

const ORG_HEADER = 'X-Grafana-Org-Id';
const ADMIN_LOGIN = process.env.GRAFANA_ADMIN_USER || 'admin';

export interface TestOrg {
  id: number;
  namespace: string;
  /** Requests as Admin inside this organization. */
  request: APIRequestContext;
  /**
   * Makes every request of this browser context run in the organization. The header applies to this
   * context only, unlike switching the user's own organization, which would move the Admin session that
   * parallel tests share.
   */
  enter(context: BrowserContext): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * A fresh organization with the Admin user as its Admin, for journeys that need a list nothing else writes to,
 * such as folder pagination, which cannot be scoped by a rule label the way rule lists are.
 */
export async function createTestOrg(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string): Promise<TestOrg> {
  const admin = await newAdminRequest(playwright, baseURL);

  const created = await admin.post('/api/orgs', { data: { name: `Folder paging ${crypto.randomUUID().slice(0, 8)}` } });
  expect(created.ok(), `POST /api/orgs -> ${created.status()} ${await created.text()}`).toBeTruthy();
  const id: number = (await created.json()).orgId;

  // Creating an organization normally makes its creator an Admin; checking keeps the journey from
  // depending on that.
  const memberships: Array<{ orgId: number }> = await (await admin.get('/api/user/orgs')).json();
  if (!memberships.some((membership) => membership.orgId === id)) {
    const added = await admin.post(`/api/orgs/${id}/users`, { data: { loginOrEmail: ADMIN_LOGIN, role: 'Admin' } });
    expect(added.ok(), `POST /api/orgs/${id}/users -> ${added.status()} ${await added.text()}`).toBeTruthy();
  }

  const request = await newAdminRequest(playwright, baseURL, { [ORG_HEADER]: String(id) });
  const namespace = await getNamespace(request);
  expect(namespace, 'the organization-scoped request must resolve to the new organization').not.toBe('default');

  // Recording rules need a write target, and data sources belong to one organization.
  const dataSource = await request.post('/api/datasources', {
    data: {
      name: recordingTargetDataSource,
      uid: recordingTargetDataSource,
      type: 'prometheus',
      access: 'proxy',
      url: 'http://localhost:9090',
    },
  });
  expect(dataSource.ok(), `POST /api/datasources -> ${dataSource.status()} ${await dataSource.text()}`).toBeTruthy();

  return {
    id,
    namespace,
    request,
    enter: (context) => context.setExtraHTTPHeaders({ [ORG_HEADER]: String(id) }),
    dispose: async () => {
      // Best effort: the organization and everything in it is of no use after the test.
      await admin.delete(`/api/orgs/${id}`).catch(() => undefined);
      await request.dispose();
      await admin.dispose();
    },
  };
}

/**
 * Waits until the folder search the Folders mode reads lists every given folder. Rule writes label their
 * folder asynchronously, and a folder without the label is not listed.
 */
export async function waitForListedFolders(org: TestOrg, expectedCount: number): Promise<void> {
  await expect(async () => {
    const response = await org.request.post(
      `/apis/folder.grafana.app/v1beta1/namespaces/${org.namespace}/folders/search`,
      {
        data: {
          apiVersion: 'search.grafana.app/v0alpha1',
          kind: 'SearchQuery',
          labelSelector: { matchLabels: { 'alerting.grafana.app/has-rules': 'true' } },
          fields: ['title'],
          limit: expectedCount + 1,
        },
      }
    );
    expect(response.ok(), `POST folders/search -> ${response.status()} ${await response.text()}`).toBeTruthy();
    const body = await response.json();
    expect(body.items?.length, 'folders listed by the Folders mode search').toBe(expectedCount);
  }).toPass({ intervals: [300, 700, 1500, 3000], timeout: 60_000 });
}

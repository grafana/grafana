import { type APIRequestContext, type APIResponse, type PlaywrightWorkerArgs } from '@playwright/test';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleInstanceTotals,
  type AlertRuleAlertRuleState,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { expect } from '@grafana/plugin-e2e';

export const contactPoint = 'empty';

export const testDataSourceUid = 'PD8C576611E62080A';
export const prometheusDataSourceUid = 'gdev-prometheus';

// Recording rules need a real datasource UID though the rule never queries it.
export const recordingTargetDataSource = 'prometheus';

export type RuleKind = 'alertrules' | 'recordingrules';

export function rulesApiBase(namespace: string): string {
  return `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}`;
}

type RequestOptions = { data?: unknown; headers?: Record<string, string> };

// Retries transient 403/500s from the SQLITE_BUSY race; folder create passes a longer budget.
async function sendWithRetry(
  request: APIRequestContext,
  method: 'post' | 'patch',
  url: string,
  options: RequestOptions,
  timeout: number
): Promise<APIResponse> {
  let response: APIResponse | undefined;
  await expect(async () => {
    response = await request[method](url, options);
    expect(
      response.ok(),
      `${method.toUpperCase()} ${url} -> ${response.status()} ${await response.text()}`
    ).toBeTruthy();
  }).toPass({ intervals: [200, 500, 1000, 2000], timeout });
  if (!response) {
    throw new Error(`${method.toUpperCase()} ${url} produced no response`);
  }
  return response;
}

export function postWithRetry(
  request: APIRequestContext,
  url: string,
  data: unknown,
  timeout = 5000
): Promise<APIResponse> {
  return sendWithRetry(request, 'post', url, { data }, timeout);
}

// From generated types so schema changes fail type checking.
export type AlertRuleState = AlertRuleAlertRuleState;
export type AlertRuleHealth = AlertRuleAlertRuleHealth;
export type RecordingRuleHealth = RecordingRuleRecordingRuleHealth;
export type AlertRuleTotals = AlertRuleAlertRuleInstanceTotals;

export interface RuleStatusSeed {
  state?: AlertRuleState;
  health?: AlertRuleHealth | RecordingRuleHealth;
  totals?: AlertRuleTotals;
}

// `execute_alerts = false`, so status is written directly. Send only given fields: a wrongly typed one drops the whole status.
export async function setRuleStatus(
  request: APIRequestContext,
  namespace: string,
  kind: RuleKind,
  uid: string,
  status: RuleStatusSeed
): Promise<void> {
  await sendWithRetry(
    request,
    'patch',
    `${rulesApiBase(namespace)}/${kind}/${encodeURIComponent(uid)}/status`,
    { data: JSON.stringify({ status }), headers: { 'Content-Type': 'application/merge-patch+json' } },
    15_000
  );
}

const TOTALS_SEARCH_FIELD: Record<keyof AlertRuleTotals, string> = {
  healthy: 'totalsHealthy',
  firing: 'totalsFiring',
  pending: 'totalsPending',
  recovering: 'totalsRecovering',
  nodata: 'totalsNoData',
  error: 'totalsError',
};
const TOTALS_FIELDS = Object.values(TOTALS_SEARCH_FIELD);

// Search lags writes; poll until every rule reports its status.
export async function waitForRuleStatusVisible(
  request: APIRequestContext,
  namespace: string,
  kind: RuleKind,
  runMarker: string,
  expected: Record<string, RuleStatusSeed>,
  timeout = 20_000
): Promise<void> {
  await expect(async () => {
    const response = await request.post(`${rulesApiBase(namespace)}/${kind}/searchRules`, {
      data: {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { filter: { field: 'labels', operator: 'In', values: [`${RUN_LABEL}=${runMarker}`] } },
        sort: [{ field: 'title', direction: 'asc' }],
        // Recording rules have no state; requesting an unknown field fails the whole search.
        fields: kind === 'alertrules' ? ['title', 'state', 'health', ...TOTALS_FIELDS] : ['title', 'health'],
        limit: 40,
      },
    });
    expect(response.ok(), `POST ${kind}/searchRules -> ${response.status()} ${await response.text()}`).toBeTruthy();
    const body = await response.json();
    const hits = new Map<string, { state?: string; health?: string; totals: Record<string, number | undefined> }>(
      (body.items ?? []).map((item: { resource: { name: string }; fields?: Record<string, string | number> }) => [
        item.resource.name,
        {
          state: item.fields?.state,
          health: item.fields?.health,
          totals: Object.fromEntries(
            Object.entries(TOTALS_SEARCH_FIELD).map(([total, field]) => [total, item.fields?.[field]])
          ),
        },
      ])
    );
    for (const [uid, status] of Object.entries(expected)) {
      const hit = hits.get(uid);
      expect(hit, `rule ${uid} is not visible in ${kind} search yet`).toBeDefined();
      if (status.state) {
        expect(hit?.state, `state of ${uid}`).toBe(status.state);
      }
      if (status.health) {
        expect(hit?.health, `health of ${uid}`).toBe(status.health);
      }
      for (const [total, count] of Object.entries(status.totals ?? {})) {
        expect(hit?.totals[total], `${total} total of ${uid}`).toBe(count);
      }
    }
  }).toPass({ intervals: [200, 500, 1000, 2000], timeout });
}

export const RUN_LABEL = 'e2e-filter-run';

export function newRunMarker(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function runScope(runMarker: string): string {
  return `label:${RUN_LABEL}=${runMarker}`;
}

export function runTitle(runMarker: string, name: string): string {
  return `${name} ${runMarker}`;
}

export function recordingMetricFor(runMarker: string, name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${runMarker}`;
}

export interface AlertRuleSeed {
  title: string;
  interval?: string;
  paused?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  receiver?: string;
  routingTree?: string;
  /** Omit notification settings to follow the default policy; overrides `routingTree` and `receiver`. */
  defaultRouting?: boolean;
  panel?: { dashboardUid: string; panelId: number };
  queryDataSourceUid?: string;
  status?: RuleStatusSeed;
  folderUid?: string;
}

export interface RecordingRuleSeed {
  title: string;
  metric: string;
  interval?: string;
  paused?: boolean;
  labels?: Record<string, string>;
  queryDataSourceUid?: string;
  targetDataSourceUid?: string;
  status?: RuleStatusSeed;
  folderUid?: string;
}

const MATH_EXPRESSION = {
  model: { refId: 'A', type: 'math', expression: '1 == 1' },
  datasourceUID: '__expr__',
  queryType: '',
  source: true,
};

function dataSourceQuery(refId: string, uid: string, source: boolean) {
  return {
    datasourceUID: uid,
    queryType: '',
    relativeTimeRange: { from: '10m', to: '0s' },
    model: { refId, datasource: { uid }, expr: 'vector(1)', scenarioId: 'random_walk' },
    ...(source ? { source: true } : {}),
  };
}

function alertExpressions(queryDataSourceUid?: string) {
  if (!queryDataSourceUid) {
    return { A: MATH_EXPRESSION };
  }
  return {
    A: dataSourceQuery('A', queryDataSourceUid, false),
    B: {
      datasourceUID: '__expr__',
      queryType: '',
      model: {
        refId: 'B',
        type: 'reduce',
        expression: 'A',
        reducer: 'last',
        settings: { mode: 'dropNN' },
        datasource: { type: '__expr__', uid: '__expr__' },
      },
    },
    C: {
      datasourceUID: '__expr__',
      queryType: '',
      source: true,
      model: {
        refId: 'C',
        type: 'threshold',
        expression: 'B',
        conditions: [{ evaluator: { type: 'gt', params: [0] }, type: 'query', query: { params: ['B'] } }],
        datasource: { type: '__expr__', uid: '__expr__' },
      },
    },
  };
}

export async function createAlertRule(
  request: APIRequestContext,
  namespace: string,
  folderUid: string,
  seed: AlertRuleSeed
): Promise<string> {
  const notificationSettings = seed.defaultRouting
    ? undefined
    : seed.routingTree
      ? { type: 'NamedRoutingTree', routingTree: seed.routingTree }
      : { type: 'SimplifiedRouting', receiver: seed.receiver ?? contactPoint };

  const response = await postWithRetry(request, `${rulesApiBase(namespace)}/alertrules`, {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'AlertRule',
    metadata: { annotations: { 'grafana.app/folder': seed.folderUid ?? folderUid } },
    spec: {
      title: seed.title,
      trigger: { interval: seed.interval ?? '1m' },
      noDataState: 'NoData',
      execErrState: 'Error',
      paused: seed.paused ?? true,
      ...(seed.labels ? { labels: seed.labels } : {}),
      ...(seed.annotations ? { annotations: seed.annotations } : {}),
      ...(seed.panel ? { panelRef: { dashboardUID: seed.panel.dashboardUid, panelID: seed.panel.panelId } } : {}),
      ...(notificationSettings ? { notificationSettings } : {}),
      expressions: alertExpressions(seed.queryDataSourceUid),
    },
  });
  const uid: string = (await response.json()).metadata.name;
  if (seed.status) {
    await setRuleStatus(request, namespace, 'alertrules', uid, seed.status);
  }
  return uid;
}

export async function createRecordingRule(
  request: APIRequestContext,
  namespace: string,
  folderUid: string,
  seed: RecordingRuleSeed
): Promise<string> {
  const response = await postWithRetry(request, `${rulesApiBase(namespace)}/recordingrules`, {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'RecordingRule',
    metadata: { annotations: { 'grafana.app/folder': seed.folderUid ?? folderUid } },
    spec: {
      title: seed.title,
      trigger: { interval: seed.interval ?? '1m' },
      paused: seed.paused ?? true,
      metric: seed.metric,
      targetDatasourceUID: seed.targetDataSourceUid ?? recordingTargetDataSource,
      ...(seed.labels ? { labels: seed.labels } : {}),
      expressions: {
        A: seed.queryDataSourceUid ? dataSourceQuery('A', seed.queryDataSourceUid, true) : MATH_EXPRESSION,
      },
    },
  });
  const uid: string = (await response.json()).metadata.name;
  if (seed.status) {
    await setRuleStatus(request, namespace, 'recordingrules', uid, seed.status);
  }
  return uid;
}

// A folder is durable after create but unindexed reads as empty (transient 403); poll List, since Get bypasses the index.
// Workers create folders at once, so a request can stall for the SQLite `busy_timeout`; the 15s budget covers it.
export async function createFolderAndWait(
  request: APIRequestContext,
  namespace: string,
  uid: string,
  title: string
): Promise<void> {
  await postWithRetry(
    request,
    `/apis/folder.grafana.app/v1/namespaces/${namespace}/folders`,
    {
      apiVersion: 'folder.grafana.app/v1',
      kind: 'Folder',
      metadata: { name: uid },
      spec: { title },
    },
    15_000
  );

  await expect(async () => {
    const res = await request.get(
      `/apis/folder.grafana.app/v1/namespaces/${namespace}/folders?fieldSelector=metadata.name%3D${uid}`
    );
    expect(res.ok(), `GET folders?fieldSelector=metadata.name=${uid} -> ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.items?.length > 0, `folder ${uid} not yet visible in list`).toBeTruthy();
  }).toPass({ intervals: [50, 100, 200, 400], timeout: 15_000 });
}

export async function deleteFolder(request: APIRequestContext, uid: string): Promise<void> {
  const deleted = await request.delete(`/api/folders/${uid}`);
  if (!deleted.ok()) {
    await request.delete(`/api/folders/${uid}?forceDeleteRules=true`);
  }
}

export async function createContactPoint(request: APIRequestContext, name: string): Promise<string> {
  const response = await sendWithRetry(
    request,
    'post',
    '/api/v1/provisioning/contact-points',
    {
      data: { name, type: 'email', settings: { addresses: 'oncall@example.com' } },
      headers: { 'X-Disable-Provenance': 'true' },
    },
    10_000
  );
  return (await response.json()).uid;
}

export async function createRoutingTree(request: APIRequestContext, namespace: string, name: string): Promise<void> {
  await postWithRetry(
    request,
    `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/${namespace}/routingtrees`,
    {
      apiVersion: 'notifications.alerting.grafana.app/v1beta1',
      kind: 'RoutingTree',
      metadata: { name },
      spec: { defaults: { receiver: contactPoint, group_by: ['grafana_folder', 'alertname'] }, routes: [] },
    },
    10_000
  );
}

export async function createDashboard(
  request: APIRequestContext,
  uid: string,
  title: string,
  panelIds: number[]
): Promise<void> {
  await postWithRetry(
    request,
    '/api/dashboards/db',
    {
      dashboard: {
        uid,
        title,
        schemaVersion: 41,
        panels: panelIds.map((id) => ({
          id,
          type: 'text',
          title: `Panel ${id}`,
          gridPos: { x: 0, y: id * 4, w: 12, h: 4 },
        })),
      },
      overwrite: false,
    },
    10_000
  );
}

export async function newAdminRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string,
  extraHTTPHeaders?: Record<string, string>
): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL, storageState: 'playwright/.auth/admin.json', extraHTTPHeaders });
}

export async function getNamespace(request: APIRequestContext): Promise<string> {
  const settings = await (await request.get('/api/frontend/settings')).json();
  return settings.namespace ?? 'default';
}

// Only the instance's own namespace is accepted; others get 403.
export async function ruleResourceUrl(request: APIRequestContext, kind: RuleKind, uid: string): Promise<string> {
  return `${rulesApiBase(await getNamespace(request))}/${kind}/${encodeURIComponent(uid)}`;
}

export async function deleteRule(
  request: APIRequestContext,
  namespace: string,
  kind: RuleKind,
  uid: string
): Promise<void> {
  const deleted = await request.delete(`${rulesApiBase(namespace)}/${kind}/${encodeURIComponent(uid)}`);
  expect(deleted.ok(), `DELETE ${kind}/${uid} -> ${deleted.status()} ${await deleted.text()}`).toBeTruthy();
}

export async function markProvisioned(request: APIRequestContext, kind: RuleKind, uid: string): Promise<void> {
  const response = await request.patch(await ruleResourceUrl(request, kind, uid), {
    headers: { 'Content-Type': 'application/merge-patch+json' },
    data: { metadata: { annotations: { 'grafana.com/provenance': 'api' } } },
  });
  expect(response.ok(), `mark provisioned -> ${response.status()}`).toBeTruthy();
}

import { type APIRequestContext, type APIResponse, type PlaywrightWorkerArgs } from '@playwright/test';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleInstanceTotals,
  type AlertRuleAlertRuleState,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { expect } from '@grafana/plugin-e2e';

// "empty" is the default contact point Grafana provisions on a fresh dev install.
export const contactPoint = 'empty';

// The data sources devenv provisions (devenv/datasources.yaml), which the E2E server copies in.
export const testDataSourceUid = 'PD8C576611E62080A';
export const prometheusDataSourceUid = 'gdev-prometheus';

// The datasource this dev instance provisions the recorded metric's write target against.
// Recording rules require a real datasource UID here even though the paused math expression
// below never actually queries or writes anything.
export const recordingTargetDataSource = 'prometheus';

export type RuleKind = 'alertrules' | 'recordingrules';

export function rulesApiBase(namespace: string): string {
  return `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}`;
}

type RequestOptions = { data?: unknown; headers?: Record<string, string> };

// A write that retries a transient failure with Playwright's built-in expect(...).toPass. At the worker
// startup burst the write (or its folders:read authz check) can lose the SQLITE_BUSY race against the
// e2e server's small SQLite connection pool and return a transient 403/500. Default timeout is bounded
// so a genuine failure still surfaces quickly with its status/body; the folder-create call passes
// a longer one since a single attempt can itself take as long as the server's `busy_timeout` (7.5s).
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
  // toPass only resolves once the callback passed, so response is set; the guard narrows the type.
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

// Taken from the generated API types so a change to the status schema fails type checking here
// instead of surfacing as a status the server silently drops.
export type AlertRuleState = AlertRuleAlertRuleState;
export type AlertRuleHealth = AlertRuleAlertRuleHealth;
export type RecordingRuleHealth = RecordingRuleRecordingRuleHealth;
export type AlertRuleTotals = AlertRuleAlertRuleInstanceTotals;

export interface RuleStatusSeed {
  state?: AlertRuleState;
  health?: AlertRuleHealth | RecordingRuleHealth;
  /** Alert rules only: the server ignores totals on a recording rule. */
  totals?: AlertRuleTotals;
}

// The E2E server runs with `execute_alerts = false`, so the status syncer never produces rule status.
// Specs that need state, health or instance totals write them through the status subresource instead.
// Only the given fields are sent: a wrongly typed field makes the legacy search drop the rule's whole
// status, and merge-patch leaves everything else alone.
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

// The search response names each instance total `totals<State>`; a total the rule has no value for is absent.
const TOTALS_SEARCH_FIELD: Record<keyof AlertRuleTotals, string> = {
  healthy: 'totalsHealthy',
  firing: 'totalsFiring',
  pending: 'totalsPending',
  recovering: 'totalsRecovering',
  nodata: 'totalsNoData',
  error: 'totalsError',
};
const TOTALS_FIELDS = Object.values(TOTALS_SEARCH_FIELD);

// The search read path can lag the write, like the folder list does, and a status patch is a write
// too. Poll the per-kind searchRules endpoint the UI reads until every seeded rule reports the status
// it was given, so a browser assertion never races the patch.
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
        // Recording rules have no state, and requesting an unknown field fails the whole search.
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

// Every rule a filter journey seeds carries this label with the journey's own value, so the journey
// can scope its list to those rules and never depends on what else exists on the instance.
export const RUN_LABEL = 'e2e-filter-run';

export function newRunMarker(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** The search token that limits a list to one journey's rules. */
export function runScope(runMarker: string): string {
  return `label:${RUN_LABEL}=${runMarker}`;
}

export interface AlertRuleSeed {
  title: string;
  interval?: string;
  paused?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  /** Direct routing to this contact point; defaults to the provisioned "empty" one. */
  receiver?: string;
  /** Named routing tree. Takes precedence over `receiver`. */
  routingTree?: string;
  panel?: { dashboardUid: string; panelId: number };
  /** A real data source the rule queries; without it the rule only has server-side expressions. */
  queryDataSourceUid?: string;
  status?: RuleStatusSeed;
  /** Folder to create the rule in; defaults to the fixture's folder. */
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
  // The same query -> reduce -> threshold shape the rule form produces, so the condition is valid.
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
  const notificationSettings = seed.routingTree
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
      notificationSettings,
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

// The create above only guarantees the folder is durably written, not that it's visible yet:
// every read (including the ruler API's namespace lookup that seeding depends on)
// is served off a search index that's updated asynchronously from the write. A folder that
// exists but isn't indexed yet reads back as zero results, which callers can't distinguish
// from "doesn't exist" - surfacing as a transient 403 on the very next request. List (not a
// per-uid Get, which reads the primary store directly and would race past this) is what
// actually exercises that index, so poll it until the new folder shows up.
//
// All workers create their folder at the same instant, so this single request can itself stall for
// as long as the server's SQLite `busy_timeout` (7.5s, scripts/grafana-server/custom.ini) before it
// resolves. A 15s retry budget (default is 5s) gives it room to survive that instead of giving up
// before the server has even finished stalling on the first attempt.
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

// Provisioning API with provenance disabled, so the contact point stays editable and deletable.
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

// A context authenticated as Admin, for seeding from a spec whose own `request`/`page` belong to
// another role (the Viewer and Editor projects authenticate as those users).
export async function newAdminRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL, storageState: 'playwright/.auth/admin.json' });
}

export async function getNamespace(request: APIRequestContext): Promise<string> {
  const settings = await (await request.get('/api/frontend/settings')).json();
  return settings.namespace ?? 'default';
}

import { type APIRequestContext, expect } from '@playwright/test';

import { postWithRetry, recordingTargetDataSource } from '../fixtures';

import { type CorpusFolder, type CorpusManifest } from './corpusState';

const TEAMS = [
  'API gateway',
  'Checkout',
  'Payments',
  'Billing',
  'Search',
  'Notifications',
  'Auth',
  'Inventory',
  'Shipping',
  'Catalog',
  'Recommendations',
  'Fraud',
  'Sessions',
  'Reporting',
];

const SUBJECTS = [
  'CPU usage',
  'Memory pressure',
  'Disk space low',
  'Node load average',
  'HTTP error rate',
  'Queue depth',
];

const DENSE_RULE_COUNT = 80;
const ONE_EACH_FOLDER_COUNT = 39;
const RULES_PER_KIND = DENSE_RULE_COUNT + ONE_EACH_FOLDER_COUNT + 1;
const CONCURRENCY = 6;

/** Bounded concurrency: full parallelism only adds SQLITE_BUSY retries. */
export async function mapBounded<T, R>(items: T[], worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function runNext(): Promise<void> {
    const index = next++;
    if (index >= items.length) {
      return;
    }
    results[index] = await worker(items[index], index);
    await runNext();
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => runNext()));
  return results;
}

async function createFolder(
  request: APIRequestContext,
  namespace: string,
  uid: string,
  title: string,
  parentUid?: string
): Promise<void> {
  await postWithRetry(
    request,
    `/apis/folder.grafana.app/v1/namespaces/${namespace}/folders`,
    {
      apiVersion: 'folder.grafana.app/v1',
      kind: 'Folder',
      metadata: { name: uid, ...(parentUid ? { annotations: { 'grafana.app/folder': parentUid } } : {}) },
      spec: { title },
    },
    15_000
  );
}

async function seedAlertRule(
  request: APIRequestContext,
  namespace: string,
  folderUid: string,
  title: string,
  runMarker: string
): Promise<string> {
  const response = await postWithRetry(
    request,
    `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}/alertrules`,
    {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'AlertRule',
      metadata: { annotations: { 'grafana.app/folder': folderUid } },
      spec: {
        title,
        trigger: { interval: '1m' },
        noDataState: 'NoData',
        execErrState: 'Error',
        paused: true,
        labels: { 'e2e-corpus-run': runMarker },
        notificationSettings: { type: 'SimplifiedRouting', receiver: 'empty' },
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
  return (await response.json()).metadata.name;
}

async function seedRecordingRule(
  request: APIRequestContext,
  namespace: string,
  folderUid: string,
  title: string,
  metric: string,
  runMarker: string
): Promise<string> {
  const response = await postWithRetry(
    request,
    `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}/recordingrules`,
    {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'RecordingRule',
      metadata: { annotations: { 'grafana.app/folder': folderUid } },
      spec: {
        title,
        trigger: { interval: '1m' },
        paused: true,
        metric,
        targetDatasourceUID: recordingTargetDataSource,
        labels: { 'e2e-corpus-run': runMarker },
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
  return (await response.json()).metadata.name;
}

function folderTitle(index: number, runSuffix: string): string {
  return `${TEAMS[index % TEAMS.length]} alerts ${index} ${runSuffix}`;
}

function ruleTitle(subjectIndex: number, folderIndex: number, ruleIndex: number, runSuffix: string): string {
  return `${SUBJECTS[subjectIndex % SUBJECTS.length]} f${folderIndex}r${ruleIndex} ${runSuffix}`;
}

function metricName(folderIndex: number, ruleIndex: number, runSuffix: string): string {
  return `corpus_${runSuffix.replace(/-/g, '_')}_f${folderIndex}_r${ruleIndex}`;
}

/** Seeds the read-only corpus: 43 folders, 120 rules of each kind, all labeled with a run marker. */
export async function seedCorpus(request: APIRequestContext, namespace: string): Promise<CorpusManifest> {
  const startedAt = Date.now();
  const runMarker = crypto.randomUUID().slice(0, 8);
  const runSuffix = runMarker;

  const folderUids = Array.from({ length: 1 + ONE_EACH_FOLDER_COUNT + 3 }, (_, i) => `e2e-corpus-${runSuffix}-f${i}`);
  const [denseFolderUid, ...restFolderUids] = folderUids;
  const oneEachFolderUids = restFolderUids.slice(0, ONE_EACH_FOLDER_COUNT);
  const [alertOnlyFolderUid, recordingOnlyFolderUid, emptyFolderUid] = restFolderUids.slice(ONE_EACH_FOLDER_COUNT);
  const nestedFolderUid = oneEachFolderUids[1];
  const nestedParentUid = oneEachFolderUids[0];

  await mapBounded(folderUids, async (uid, index) => {
    const parentUid = uid === nestedFolderUid ? nestedParentUid : undefined;
    await createFolder(request, namespace, uid, folderTitle(index, runSuffix), parentUid);
  });

  // Folder list reads an async index; wait for it before seeding rules or the folder lookup can 403.
  await expect(async () => {
    const res = await request.get(`/apis/folder.grafana.app/v1/namespaces/${namespace}/folders`);
    expect(res.ok(), `GET folders -> ${res.status()}`).toBeTruthy();
    const body = await res.json();
    const visibleUids = new Set((body.items ?? []).map((item: { metadata: { name: string } }) => item.metadata.name));
    const missing = folderUids.filter((uid) => !visibleUids.has(uid));
    expect(missing.length, `folders not yet visible: ${missing.join(', ')}`).toBe(0);
  }).toPass({ intervals: [200, 500, 1000, 2000], timeout: 30_000 });

  const folders: CorpusFolder[] = folderUids.map((uid, index) => ({
    uid,
    title: folderTitle(index, runSuffix),
    parentUid: uid === nestedFolderUid ? nestedParentUid : undefined,
    alertRules: [],
    recordingRules: [],
  }));
  const folderByUid = new Map(folders.map((f) => [f.uid, f]));

  type RuleTask = { folderUid: string; folderIndex: number; ruleIndex: number };
  const alertTasks: RuleTask[] = [];
  const recordingTasks: RuleTask[] = [];
  for (let r = 0; r < DENSE_RULE_COUNT; r++) {
    alertTasks.push({ folderUid: denseFolderUid, folderIndex: 0, ruleIndex: r });
    recordingTasks.push({ folderUid: denseFolderUid, folderIndex: 0, ruleIndex: r });
  }
  oneEachFolderUids.forEach((uid, i) => {
    const folderIndex = i + 1;
    alertTasks.push({ folderUid: uid, folderIndex, ruleIndex: 0 });
    recordingTasks.push({ folderUid: uid, folderIndex, ruleIndex: 0 });
  });
  alertTasks.push({ folderUid: alertOnlyFolderUid, folderIndex: ONE_EACH_FOLDER_COUNT + 1, ruleIndex: 0 });
  recordingTasks.push({ folderUid: recordingOnlyFolderUid, folderIndex: ONE_EACH_FOLDER_COUNT + 2, ruleIndex: 0 });

  await mapBounded(alertTasks, async ({ folderUid, folderIndex, ruleIndex }, i) => {
    const title = ruleTitle(i, folderIndex, ruleIndex, runSuffix);
    const uid = await seedAlertRule(request, namespace, folderUid, title, runMarker);
    folderByUid.get(folderUid)!.alertRules.push({ uid, title });
  });

  await mapBounded(recordingTasks, async ({ folderUid, folderIndex, ruleIndex }, i) => {
    const title = ruleTitle(i, folderIndex, ruleIndex, runSuffix);
    const metric = metricName(folderIndex, ruleIndex, runSuffix);
    const uid = await seedRecordingRule(request, namespace, folderUid, title, metric, runMarker);
    folderByUid.get(folderUid)!.recordingRules.push({ uid, title });
  });

  // One marker-scoped check; search visibility, not the write, may lag.
  await waitForMarkerCount(request, namespace, 'alertrules', runMarker, RULES_PER_KIND);
  await waitForMarkerCount(request, namespace, 'recordingrules', runMarker, RULES_PER_KIND);

  return {
    runMarker,
    denseFolderUid,
    alertOnlyFolderUid,
    recordingOnlyFolderUid,
    emptyFolderUid,
    nestedFolderUid,
    folders,
    setupDurationMs: Date.now() - startedAt,
  };
}

async function waitForMarkerCount(
  request: APIRequestContext,
  namespace: string,
  kind: 'alertrules' | 'recordingrules',
  runMarker: string,
  expectedCount: number
): Promise<void> {
  await expect(async () => {
    const res = await request.post(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}/${kind}/searchRules`,
      {
        data: {
          apiVersion: 'search.grafana.app/v0alpha1',
          kind: 'SearchQuery',
          where: { filter: { field: 'labels', operator: 'In', values: [`e2e-corpus-run=${runMarker}`] } },
          sort: [{ field: 'title', direction: 'asc' }],
          fields: ['title'],
          limit: 1,
        },
      }
    );
    expect(res.ok(), `POST ${kind}/searchRules -> ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(body.metadata?.totalHits, `expected ${expectedCount} ${kind} for run ${runMarker}`).toBe(expectedCount);
  }).toPass({ intervals: [300, 700, 1500, 3000], timeout: 60_000 });
}

/** Best-effort per folder; cascades to rules. */
export async function teardownCorpus(request: APIRequestContext, manifest: CorpusManifest): Promise<void> {
  const folderUids = manifest.folders.map((f) => f.uid);
  // Nested folder first in case cascade with a live child differs.
  const ordered = [
    ...folderUids.filter((uid) => uid === manifest.nestedFolderUid),
    ...folderUids.filter((uid) => uid !== manifest.nestedFolderUid),
  ];

  await mapBounded(ordered, async (uid) => {
    try {
      await request.delete(`/api/folders/${uid}?forceDeleteRules=true`);
    } catch {
      // best-effort cleanup
    }
  });
}

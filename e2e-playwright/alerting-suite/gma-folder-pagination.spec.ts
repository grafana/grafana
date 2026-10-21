import { type APIRequestContext } from '@playwright/test';

import { test as base, expect } from '@grafana/plugin-e2e';

import { mapBounded } from './corpus/seedCorpus';
import { RuleListPage, type RuleListKind, folderScope } from './pages/RuleListPage';
import { createAlertRule, createFolderAndWait, createRecordingRule, deleteFolder, getNamespace } from './ruleSeeding';

// Folders mode can't be scoped by label, so seed more folders than a page holds and filter to exactly them.
const PAGE_SIZE = 40;
const FOLDER_COUNT = PAGE_SIZE + 5;

interface PagedFolders {
  scope: string;
  firstPage: string[];
  secondPage: string[];
}

function ruleTitle(folderIndex: number): string {
  return `High CPU usage ${String(folderIndex + 1).padStart(2, '0')}`;
}

const test = base.extend<{ ruleKind: RuleListKind; pagedFolders: PagedFolders }>({
  ruleKind: ['alert', { option: true }],

  // Rule writes are what label a folder as holding rules.
  pagedFolders: [
    async ({ request, ruleKind }, use) => {
      const namespace = await getNamespace(request);
      const runId = crypto.randomUUID().slice(0, 8);
      const folderUids = Array.from({ length: FOLDER_COUNT }, (_, i) => `platform-alerts-${runId}-${i + 1}`);
      const titles = folderUids.map((_, i) => `Platform alerts ${String(i + 1).padStart(2, '0')} ${runId}`);

      try {
        await mapBounded(folderUids, async (folderUid, index) => {
          await createFolderAndWait(request, namespace, folderUid, titles[index]);
          if (ruleKind === 'alert') {
            await createAlertRule(request, namespace, folderUid, {
              title: ruleTitle(index),
              defaultRouting: true,
            });
          } else {
            await createRecordingRule(request, namespace, folderUid, {
              title: ruleTitle(index),
              metric: `cpu_usage_${runId}_${index + 1}`,
            });
          }
        });
        await waitForListedFolders(request, namespace, folderUids);
        await use({
          scope: folderScope(...folderUids),
          firstPage: titles.slice(0, PAGE_SIZE),
          secondPage: titles.slice(PAGE_SIZE),
        });
      } finally {
        await mapBounded(folderUids, (folderUid) => deleteFolder(request, folderUid).catch(() => undefined));
      }
    },
    // Seeding outlasts the default test budget.
    { timeout: 120_000 },
  ],
});

/** Rule writes label folders asynchronously. */
async function waitForListedFolders(request: APIRequestContext, namespace: string, folderUids: string[]) {
  await expect(async () => {
    const response = await request.post(`/apis/folder.grafana.app/v1beta1/namespaces/${namespace}/folders/search`, {
      data: {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        labelSelector: { matchLabels: { 'alerting.grafana.app/has-rules': 'true' } },
        where: { filter: { field: 'name', operator: 'In', values: folderUids } },
        fields: ['title'],
        limit: folderUids.length + 1,
      },
    });
    expect(response.ok(), `POST folders/search -> ${response.status()} ${await response.text()}`).toBeTruthy();
    const body = await response.json();
    expect(body.items?.length, 'folders listed by the Folders mode search').toBe(folderUids.length);
  }).toPass({ intervals: [300, 700, 1500, 3000], timeout: 60_000 });
}

test.describe('Alert rules: Folders pagination', () => {
  test.use({ ruleKind: 'alert' });

  test('Previous and Next move between the first 40 folders and the rest, and several folders stay open', async ({
    page,
    pagedFolders,
  }) => {
    const list = new RuleListPage(page, 'alert');
    await list.gotoFolders(pagedFolders.scope);

    await list.expectFolders(pagedFolders.firstPage);
    await expect(list.folderRow(pagedFolders.firstPage[0])).toContainText('1 alert rule');
    await expect(list.previousButton).toBeDisabled();
    await expect(list.nextButton).toBeEnabled();

    await list.nextButton.click();
    await list.expectFolders(pagedFolders.secondPage);
    await expect(list.nextButton).toBeDisabled();
    await expect(list.previousButton).toBeEnabled();

    await list.previousButton.click();
    await list.expectFolders(pagedFolders.firstPage);

    await list.toggleFolder(pagedFolders.firstPage[0]);
    await list.toggleFolder(pagedFolders.firstPage[1]);
    await expect(list.ruleLink(ruleTitle(0))).toBeVisible();
    await expect(list.ruleLink(ruleTitle(1))).toBeVisible();
  });
});

test.describe('Recording rules: Folders pagination', () => {
  test.use({ ruleKind: 'recording' });

  test('Previous and Next move between the first 40 folders and the rest, with Recording-only counts', async ({
    page,
    pagedFolders,
  }) => {
    const list = new RuleListPage(page, 'recording');
    await list.gotoFolders(pagedFolders.scope);

    await list.expectFolders(pagedFolders.firstPage);
    await expect(list.folderRow(pagedFolders.firstPage[0])).toContainText('1 recording rule');
    await expect(list.previousButton).toBeDisabled();
    await expect(list.nextButton).toBeEnabled();

    await list.nextButton.click();
    await list.expectFolders(pagedFolders.secondPage);
    await expect(list.folderRow(pagedFolders.secondPage[0])).toContainText('1 recording rule');
    await expect(list.nextButton).toBeDisabled();
    await expect(list.previousButton).toBeEnabled();

    await list.previousButton.click();
    await list.expectFolders(pagedFolders.firstPage);
  });
});

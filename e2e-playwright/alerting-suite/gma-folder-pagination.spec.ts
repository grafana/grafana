import { test as base, expect } from '@grafana/plugin-e2e';

import { mapBounded } from './corpus/seedCorpus';
import { RuleListPage, type RuleListKind } from './pages/RuleListPage';
import { createAlertRule, createFolderAndWait, createRecordingRule } from './ruleSeeding';
import { type TestOrg, createTestOrg, waitForListedFolders } from './testOrg';

// Folder pages cannot be scoped by a rule label, so every folder in the list would count. These
// journeys run in an organization of their own, holding only the folders seeded here, which makes
// the exact folders on each page predictable.
const PAGE_SIZE = 40;
const FOLDER_COUNT = PAGE_SIZE + 5;

const folderTitles = Array.from(
  { length: FOLDER_COUNT },
  (_, i) => `Platform alerts ${String(i + 1).padStart(2, '0')}`
);
const firstPage = folderTitles.slice(0, PAGE_SIZE);
const secondPage = folderTitles.slice(PAGE_SIZE);

function ruleTitle(folderIndex: number): string {
  return `High CPU usage ${String(folderIndex + 1).padStart(2, '0')}`;
}

const test = base.extend<{ ruleKind: RuleListKind; folderOrg: TestOrg }>({
  ruleKind: ['alert', { option: true }],

  // One organization per test, with one folder per title and one rule of the page's kind in each, so every
  // folder is listed. The rule writes are what label a folder as holding rules.
  folderOrg: [
    async ({ playwright, baseURL, ruleKind }, use) => {
      if (!baseURL) {
        throw new Error('baseURL is required to create the organization');
      }
      const org = await createTestOrg(playwright, baseURL);
      try {
        await mapBounded(folderTitles, async (title, index) => {
          const folderUid = `platform-alerts-${index + 1}`;
          await createFolderAndWait(org.request, org.namespace, folderUid, title);
          if (ruleKind === 'alert') {
            await createAlertRule(org.request, org.namespace, folderUid, {
              title: ruleTitle(index),
              defaultRouting: true,
            });
          } else {
            await createRecordingRule(org.request, org.namespace, folderUid, {
              title: ruleTitle(index),
              metric: `cpu_usage_${index + 1}`,
            });
          }
        });
        await waitForListedFolders(org, FOLDER_COUNT);
        await use(org);
      } finally {
        await org.dispose();
      }
    },
    // Seeding a few hundred writes takes longer than a test's own budget, so it gets its own.
    { timeout: 120_000 },
  ],
});

test.describe('Alert rules: Folders pagination', () => {
  test.use({ ruleKind: 'alert' });

  test('ALERT-1: Previous and Next move between the first 40 folders and the rest, and several folders stay open', async ({
    page,
    folderOrg,
  }) => {
    await folderOrg.enter(page.context());
    const list = new RuleListPage(page, 'alert');
    await list.gotoFolders();

    await list.expectFolders(firstPage);
    await expect(list.folderRow(firstPage[0])).toContainText('1 alert rule');
    await expect(list.previousButton).toBeDisabled();
    await expect(list.nextButton).toBeEnabled();

    await list.nextButton.click();
    await list.expectFolders(secondPage);
    await expect(list.nextButton).toBeDisabled();
    await expect(list.previousButton).toBeEnabled();

    await list.previousButton.click();
    await list.expectFolders(firstPage);

    await list.toggleFolder(firstPage[0]);
    await list.toggleFolder(firstPage[1]);
    await expect(list.ruleLink(ruleTitle(0))).toBeVisible();
    await expect(list.ruleLink(ruleTitle(1))).toBeVisible();
  });
});

test.describe('Recording rules: Folders pagination', () => {
  test.use({ ruleKind: 'recording' });

  test('REC-1: Previous and Next move between the first 40 folders and the rest, with Recording-only counts', async ({
    page,
    folderOrg,
  }) => {
    await folderOrg.enter(page.context());
    const list = new RuleListPage(page, 'recording');
    await list.gotoFolders();

    await list.expectFolders(firstPage);
    await expect(list.folderRow(firstPage[0])).toContainText('1 recording rule');
    await expect(list.previousButton).toBeDisabled();
    await expect(list.nextButton).toBeEnabled();

    await list.nextButton.click();
    await list.expectFolders(secondPage);
    await expect(list.folderRow(secondPage[0])).toContainText('1 recording rule');
    await expect(list.nextButton).toBeDisabled();
    await expect(list.previousButton).toBeEnabled();

    await list.previousButton.click();
    await list.expectFolders(firstPage);
  });
});

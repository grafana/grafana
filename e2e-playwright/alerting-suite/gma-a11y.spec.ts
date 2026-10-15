import { type AxeResults } from 'axe-core';

import { type AxeScanContext, DEFAULT_A11Y_TAGS } from '@grafana/plugin-e2e';

import { type Page, test, expect } from './fixtures';
import { RuleListPage, folderScope } from './pages/RuleListPage';
import { deleteRule } from './ruleSeeding';

async function runA11yScan(page: Page, scanForA11yViolations: (context?: AxeScanContext) => Promise<AxeResults>) {
  const results = await scanForA11yViolations({
    options: { runOnly: { type: 'tag', values: DEFAULT_A11Y_TAGS } },
  });
  expect(results).toHaveNoA11yViolations();
}

test.describe(
  'GMA rule list accessibility',
  {
    tag: ['@a11y'],
  },
  () => {
    test('Alert rules: Folders mode with one folder expanded has no violations', async ({
      page,
      folder,
      alertRules,
      scanForA11yViolations,
    }) => {
      const title = 'High CPU usage';
      await alertRules.seedRule({ title, interval: '1m' });

      const list = new RuleListPage(page, 'alert');
      await list.gotoFolders(folderScope(folder.uid));
      await list.toggleFolder(folder.title);
      await expect(page.getByRole('link', { name: title })).toBeVisible();

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Alert rules: List mode has no violations', async ({ page, folder, alertRules, scanForA11yViolations }) => {
      const title = 'Memory pressure';
      await alertRules.seedRule({ title, interval: '1m' });

      await new RuleListPage(page, 'alert').goto(folderScope(folder.uid));
      await expect(page.getByRole('link', { name: title })).toBeVisible();

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Recording rules: Folders mode with one folder expanded has no violations', async ({
      page,
      folder,
      recordingRules,
      scanForA11yViolations,
    }) => {
      const title = 'cpu_usage:avg';
      await recordingRules.seedRule({ title, interval: '1m', metric: 'cpu_usage:avg' });

      const list = new RuleListPage(page, 'recording');
      await list.gotoFolders(folderScope(folder.uid));
      await list.toggleFolder(folder.title);
      await expect(page.getByRole('link', { name: title })).toBeVisible();

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Recording rules: List mode has no violations', async ({
      page,
      folder,
      recordingRules,
      scanForA11yViolations,
    }) => {
      const title = 'mem_usage:avg';
      await recordingRules.seedRule({ title, interval: '1m', metric: 'mem_usage:avg' });

      await new RuleListPage(page, 'recording').goto(folderScope(folder.uid));
      await expect(page.getByRole('link', { name: title })).toBeVisible();

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Alert rules: Recently deleted has no violations', async ({
      page,
      alertRules,
      workerApi,
      scanForA11yViolations,
    }) => {
      const title = `Node load average ${crypto.randomUUID().slice(0, 8)}`;
      const uid = await alertRules.seedRule({ title, interval: '1m' });
      await deleteRule(page.request, workerApi.namespace, 'alertrules', uid);

      await page.goto('/alerting/rules/alert/deleted');
      await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Recording rules: Recently deleted has no violations', async ({
      page,
      recordingRules,
      workerApi,
      scanForA11yViolations,
    }) => {
      const title = `Pod restart rate ${crypto.randomUUID().slice(0, 8)}`;
      const uid = await recordingRules.seedRule({ title, interval: '1m', metric: 'pod_restart:rate' });
      await deleteRule(page.request, workerApi.namespace, 'recordingrules', uid);

      await page.goto('/alerting/rules/recording/deleted');
      await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Alert rules: keyboard journey reaches the search input, sidebar, view toggle, folder expand, rule link and row menu; Escape returns focus to the trigger', async ({
      page,
      folder,
      alertRules,
    }) => {
      const title = 'Disk space low';
      await alertRules.seedRule({ title, interval: '1m' });

      const list = new RuleListPage(page, 'alert');
      await list.gotoFolders(folderScope(folder.uid));

      const searchInput = page.getByRole('textbox', { name: 'Search' });
      await expect(searchInput).toBeVisible();
      await searchInput.focus();
      await expect(searchInput).toBeFocused();

      // Native radio group: ArrowRight moves between options; Tab skips the group.
      const foldersRadio = page.getByRole('radio', { name: 'Folders' });
      const listRadio = page.getByRole('radio', { name: 'List' });
      await expect(foldersRadio).toBeVisible();
      await expect(listRadio).toBeVisible();
      await foldersRadio.focus();
      await expect(foldersRadio).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(listRadio).toBeFocused();
      // Arrow key selected List mode; switch back to have folders to expand.
      await page.keyboard.press('ArrowLeft');
      await expect(foldersRadio).toBeFocused();
      await expect(foldersRadio).toBeChecked();

      // Name valid in both states.
      const expandButton = list.folderRow(folder.title).getByRole('button', { name: /^(Expand|Collapse) / });
      await expect(expandButton).toBeVisible();
      await expandButton.focus();
      await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press(' ');
      await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(expandButton).toHaveAttribute('aria-expanded', 'true');

      await expect(list.ruleLink(title)).toBeVisible();
      await list.ruleLink(title).focus();
      await expect(list.ruleLink(title)).toBeFocused();

      const moreButton = list.rowMoreButton(title);
      await moreButton.focus();
      await expect(moreButton).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(list.editLink(title)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(moreButton).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(page.getByRole('menu')).toBeVisible();

      // Focus must return to the opener, not <body>.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).not.toBeVisible();
      await expect(moreButton).toBeFocused();
    });
  }
);

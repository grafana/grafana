import { test, expect } from './fixtures';
import { RuleListPage, folderScope } from './pages/RuleListPage';
import { ruleResourceUrl } from './ruleSeeding';

test.describe('Alert rule mutations', () => {
  test('Resume then Pause persist spec.paused across a reload', async ({ page, folder, alertRules }) => {
    const title = 'High CPU usage';
    await alertRules.seedRule({ title, interval: '1m' });
    const list = new RuleListPage(page, 'alert');

    await list.goto(folderScope(folder.uid));
    await expect(list.ruleLink(title)).toBeVisible();
    await expect(list.statusIcon(title, 'Paused')).toBeVisible();

    await list.openRowMenu(title);
    await page.getByRole('menuitem', { name: 'Resume', exact: true }).click();
    await expect(page.getByText('Rule resumed')).toBeVisible();

    await list.goto(folderScope(folder.uid));
    await expect(list.ruleLink(title)).toBeVisible();
    await expect(list.statusIcon(title, 'Paused')).not.toBeVisible();

    await list.openRowMenu(title);
    await page.getByRole('menuitem', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('Rule paused')).toBeVisible();

    await list.goto(folderScope(folder.uid));
    await expect(list.ruleLink(title)).toBeVisible();
    await expect(list.statusIcon(title, 'Paused')).toBeVisible();
  });

  test('Delete removes the rule from the active list after a reload', async ({ page, folder, alertRules }) => {
    const title = 'Disk space low';
    const uid = await alertRules.seedRule({ title, interval: '1m' });
    const list = new RuleListPage(page, 'alert');

    await list.goto(folderScope(folder.uid));
    await expect(list.ruleLink(title)).toBeVisible();
    await list.openRowMenu(title);
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('dialog').getByText(title, { exact: false })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await list.goto(folderScope(folder.uid));
    await expect(list.ruleLink(title)).not.toBeVisible();

    const response = await page.request.get(await ruleResourceUrl(page.request, 'alertrules', uid));
    expect(response.status()).toBe(404);
  });

  test('Resume and Delete refresh the open Folders view in place, without a page load', async ({
    page,
    folder,
    alertRules,
  }) => {
    const title = 'Node load average';
    await alertRules.seedRule({ title, interval: '1m' });
    const list = new RuleListPage(page, 'alert');

    await list.gotoFolders(folderScope(folder.uid));
    await list.toggleFolder(folder.title);
    await expect(list.folderRow(folder.title)).toContainText('1 alert rule');
    await expect(list.statusIcon(title, 'Paused')).toBeVisible();

    // A later reload would hide a missing refresh.
    let pageLoads = 0;
    page.on('load', () => pageLoads++);

    await list.openRowMenu(title);
    await page.getByRole('menuitem', { name: 'Resume', exact: true }).click();
    await expect(page.getByText('Rule resumed')).toBeVisible();
    await expect(list.statusIcon(title, 'Paused')).toHaveCount(0);

    await list.openRowMenu(title);
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(list.ruleLink(title)).toHaveCount(0);
    await expect(page.getByText('1 alert rule')).toHaveCount(0);

    expect(pageLoads).toBe(0);
  });
});

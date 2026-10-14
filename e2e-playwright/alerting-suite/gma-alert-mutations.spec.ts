import { test, expect } from './fixtures';
import { RuleListPage, folderScope } from './pages/RuleListPage';

// Each test seeds exactly one rule into its own worker folder and filters the list down to
// that folder (`namespace:<uid>`) - see fixtures.ts and AGENTS.md for the isolation/cascade
// cleanup model.
test.describe('Alert rule mutations', () => {
  test('ALERT-7: Resume then Pause persist spec.paused across a reload', async ({ page, folder, alertRules }) => {
    const title = 'High CPU usage';
    // Seeded rules start paused (see AlertRulesFixture.seedRule), so Resume is exercised first.
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

  test('ALERT-8: Delete removes the rule from the active list after a reload', async ({ page, folder, alertRules }) => {
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

    // Confirm it's really gone server-side, not just filtered out of a stale client cache.
    const response = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(uid)}`
    );
    expect(response.status()).toBe(404);
  });

  test('STATE-3: Resume and Delete refresh the open Folders view in place, without a page load', async ({
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

    // Anything after the first load that reloads the page would hide a missing refresh.
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
    // The folder count is refreshed too: it either reads zero or the folder is no longer listed.
    await expect(page.getByText('1 alert rule')).toHaveCount(0);

    expect(pageLoads).toBe(0);
  });
});

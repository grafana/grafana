import { type Page, test, expect } from './fixtures';
import { RuleListPage } from './pages/RuleListPage';
import { gotoResilient } from './waitForAppLoad';

// Each test seeds exactly one rule into its own worker folder and filters the list down to
// that folder (`namespace:<uid>`) - see fixtures.ts and AGENTS.md for the isolation/cascade
// cleanup model.
async function gotoFolderList(page: Page, folderUid: string): Promise<void> {
  await gotoResilient(page, `/alerting/rules/alert?search=${encodeURIComponent(`namespace:${folderUid}`)}&view=list`);
}

function rowMoreButton(page: Page, title: string) {
  return new RuleListPage(page, 'alert').rowMoreButton(title);
}

function pausedIcon(page: Page, title: string) {
  return new RuleListPage(page, 'alert').statusIcon(title, 'Paused');
}

test.describe('Alert rule mutations', () => {
  test.slow();

  test('ALERT-7: Resume then Pause persist spec.paused across a reload', async ({ page, folder, alertRules }) => {
    const title = 'High CPU usage';
    // Seeded rules start paused (see AlertRulesFixture.seedRule), so Resume is exercised first.
    await alertRules.seedRule({ title, interval: '1m' });

    await gotoFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });
    await expect(pausedIcon(page, title)).toBeVisible();

    await rowMoreButton(page, title).click();
    await page.getByRole('menuitem', { name: 'Resume', exact: true }).click();
    await expect(page.getByText('Rule resumed')).toBeVisible({ timeout: 20_000 });

    await gotoFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });
    await expect(pausedIcon(page, title)).not.toBeVisible();

    await rowMoreButton(page, title).click();
    await page.getByRole('menuitem', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('Rule paused')).toBeVisible({ timeout: 20_000 });

    await gotoFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });
    await expect(pausedIcon(page, title)).toBeVisible();
  });

  test('ALERT-8: Delete removes the rule from the active list after a reload', async ({ page, folder, alertRules }) => {
    const title = 'Disk space low';
    const uid = await alertRules.seedRule({ title, interval: '1m' });

    await gotoFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });
    await rowMoreButton(page, title).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('dialog').getByText(title, { exact: false })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 20_000 });

    await gotoFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).not.toBeVisible({ timeout: 20_000 });

    // Confirm it's really gone server-side, not just filtered out of a stale client cache.
    const response = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(uid)}`
    );
    expect(response.status()).toBe(404);
  });
});

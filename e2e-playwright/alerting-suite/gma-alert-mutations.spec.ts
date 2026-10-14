import { type Page, test, expect } from './fixtures';
import { gotoResilient } from './waitForAppLoad';

// Each test seeds exactly one rule into its own worker folder and filters the list down to
// that folder (`namespace:<uid>`), so the page-level locators below are unambiguous (one row)
// without a dedicated page object - see fixtures.ts and AGENTS.md for the isolation/cascade
// cleanup model.
async function gotoFolderList(page: Page, folderUid: string): Promise<void> {
  await gotoResilient(page, `/alerting/rules/alert?search=${encodeURIComponent(`namespace:${folderUid}`)}&view=list`);
}

// The page header also has its own "More" button (Design rule for provisioning), so the
// row's own More button - the next one after the rule's title link in DOM order - has to be
// targeted explicitly rather than by role+name alone.
function rowMoreButton(page: Page, title: string) {
  return page.getByRole('link', { name: title }).locator('xpath=following::button[@aria-label="More"][1]');
}

// A paused rule's status icon is named "Paused"; scoped to the row because the Alert page's sidebar
// also has a control with that name.
function pausedIcon(page: Page, title: string) {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: title }) })
    .getByLabel('Paused', { exact: true });
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
    await page.getByRole('menuitem', { name: 'Resume' }).click();
    await expect(page.getByText('Rule resumed')).toBeVisible({ timeout: 20_000 });

    await gotoFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });
    await expect(pausedIcon(page, title)).not.toBeVisible();

    await rowMoreButton(page, title).click();
    await page.getByRole('menuitem', { name: 'Pause' }).click();
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
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(page.getByRole('dialog').getByText(title, { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
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

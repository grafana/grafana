import { type Page, test, expect } from './fixtures';
import { RuleListPage } from './pages/RuleListPage';
import { gotoResilient } from './waitForAppLoad';

// RBAC-A: this file runs under the Admin-authenticated `alerting-gma` project (see
// playwright.config.ts), unlike the `.editor.spec.ts`/`.viewer.spec.ts` role-specific projects
// used for RBAC-E/RBAC-V. Admin has no capability restrictions of its own, so what's actually
// under test is that the two active pages and both Recently deleted tabs are all reachable, and
// that the action menu's own gates (useRuleActionAbilities.ts) still disable Resume/Delete with
// their reason for a provisioned rule even for an Admin, while leaving Duplicate available on it.

async function markProvisioned(page: Page, kind: 'alertrules' | 'recordingrules', uid: string) {
  const response = await page.request.patch(
    `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/${kind}/${encodeURIComponent(uid)}`,
    {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      data: { metadata: { annotations: { 'grafana.com/provenance': 'api' } } },
    }
  );
  expect(response.ok(), `mark provisioned -> ${response.status()}`).toBeTruthy();
}

test.describe('Admin (RBAC-A)', () => {
  test.slow();

  test('RBAC-A: Admin can reach both active rule pages and both Recently deleted tabs', async ({ page }) => {
    await gotoResilient(page, '/alerting/rules/alert');
    await expect(page.getByRole('heading', { name: 'Alert rules' })).toBeVisible({ timeout: 40_000 });

    await page.getByRole('tab', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted/);
    await expect(page.getByRole('tab', { name: 'Recently deleted', selected: true })).toBeVisible();

    await gotoResilient(page, '/alerting/rules/recording');
    await expect(page.getByRole('heading', { name: 'Recording rules' })).toBeVisible({ timeout: 40_000 });

    await page.getByRole('tab', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/alerting\/rules\/recording\/deleted/);
    await expect(page.getByRole('tab', { name: 'Recently deleted', selected: true })).toBeVisible();
  });

  test('RBAC-A: Admin can use Resume/Delete on a normal Alert rule, but they are disabled on a provisioned one (Duplicate stays available)', async ({
    page,
    folder,
    alertRules,
  }) => {
    const normalTitle = `Admin normal alert ${crypto.randomUUID().slice(0, 8)}`;
    const provisionedTitle = `Admin provisioned alert ${crypto.randomUUID().slice(0, 8)}`;
    await alertRules.seedRule({ title: normalTitle, interval: '1m' });
    const provisionedUid = await alertRules.seedRule({ title: provisionedTitle, interval: '1m' });
    await markProvisioned(page, 'alertrules', provisionedUid);
    const list = new RuleListPage(page, 'alert');

    await gotoResilient(
      page,
      `/alerting/rules/alert?search=${encodeURIComponent(`namespace:${folder.uid}`)}&view=list`
    );

    await expect(page.getByRole('link', { name: normalTitle })).toBeVisible({ timeout: 40_000 });
    await list.rowMoreButton(normalTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Resume', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('link', { name: provisionedTitle })).toBeVisible({ timeout: 40_000 });
    await list.rowMoreButton(provisionedTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
    // Unavailable actions stay in the menu, disabled, with the reason as part of their name.
    await expect(page.getByRole('menuitem', { name: /^(Pause|Resume): Provisioned$/ })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Delete: Provisioned', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('RBAC-A: Admin can use Resume/Delete on a normal Recording rule, but they are disabled on a provisioned one (Duplicate stays available)', async ({
    page,
    folder,
    recordingRules,
  }) => {
    const normalTitle = `Admin normal recording ${crypto.randomUUID().slice(0, 8)}`;
    const provisionedTitle = `Admin provisioned recording ${crypto.randomUUID().slice(0, 8)}`;
    await recordingRules.seedRule({
      title: normalTitle,
      interval: '1m',
      metric: `admin_normal_${crypto.randomUUID().slice(0, 8)}`,
    });
    const provisionedUid = await recordingRules.seedRule({
      title: provisionedTitle,
      interval: '1m',
      metric: `admin_provisioned_${crypto.randomUUID().slice(0, 8)}`,
    });
    await markProvisioned(page, 'recordingrules', provisionedUid);
    const list = new RuleListPage(page, 'recording');

    await gotoResilient(
      page,
      `/alerting/rules/recording?search=${encodeURIComponent(`namespace:${folder.uid}`)}&view=list`
    );

    await expect(page.getByRole('link', { name: normalTitle })).toBeVisible({ timeout: 40_000 });
    await list.rowMoreButton(normalTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Resume', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('link', { name: provisionedTitle })).toBeVisible({ timeout: 40_000 });
    await list.rowMoreButton(provisionedTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
    // Unavailable actions stay in the menu, disabled, with the reason as part of their name.
    await expect(page.getByRole('menuitem', { name: /^(Pause|Resume): Provisioned$/ })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Delete: Provisioned', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
  });
});

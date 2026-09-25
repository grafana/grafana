import { type Page, test, expect } from './fixtures';
import { gotoResilient } from './waitForAppLoad';

// RBAC-A: this file runs under the default `alerting` project (Admin-authenticated - see
// playwright.config.ts), unlike the `.editor.spec.ts`/`.viewer.spec.ts` role-specific projects
// used for RBAC-E/RBAC-V. Admin has no capability restrictions of its own, so what's actually
// under test is that the two active pages and both Recently deleted tabs are all reachable, and
// that the action menu's own gates (useRuleActionAbilities.ts) still hide Resume/Delete for a
// provisioned rule even for an Admin, while leaving Duplicate available on it.
function rowMoreButton(page: Page, title: string) {
  return page.getByRole('link', { name: title }).locator('xpath=following::button[@aria-label="More"][1]');
}

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

  test('RBAC-A: Admin sees Resume/Delete on a normal Alert rule, but not on a provisioned one (Duplicate stays available)', async ({
    page,
    folder,
    alertRules,
  }) => {
    const normalTitle = `Admin normal alert ${crypto.randomUUID().slice(0, 8)}`;
    const provisionedTitle = `Admin provisioned alert ${crypto.randomUUID().slice(0, 8)}`;
    await alertRules.seedRule({ title: normalTitle, interval: '1m' });
    const provisionedUid = await alertRules.seedRule({ title: provisionedTitle, interval: '1m' });
    await markProvisioned(page, 'alertrules', provisionedUid);

    await gotoResilient(page, `/alerting/rules/alert?search=${encodeURIComponent(`namespace:${folder.uid}`)}&view=list`);

    await expect(page.getByRole('link', { name: normalTitle })).toBeVisible({ timeout: 40_000 });
    await rowMoreButton(page, normalTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Resume' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('link', { name: provisionedTitle })).toBeVisible({ timeout: 40_000 });
    await rowMoreButton(page, provisionedTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Resume' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Pause' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('RBAC-A: Admin sees Resume/Delete on a normal Recording rule, but not on a provisioned one (Duplicate stays available)', async ({
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

    await gotoResilient(
      page,
      `/alerting/rules/recording?search=${encodeURIComponent(`namespace:${folder.uid}`)}&view=list`
    );

    await expect(page.getByRole('link', { name: normalTitle })).toBeVisible({ timeout: 40_000 });
    await rowMoreButton(page, normalTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Resume' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('link', { name: provisionedTitle })).toBeVisible({ timeout: 40_000 });
    await rowMoreButton(page, provisionedTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Resume' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Pause' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
});

import { test, expect } from './fixtures';
import { RuleListPage, folderScope } from './pages/RuleListPage';
import { markProvisioned } from './ruleSeeding';

// RBAC-A: provisioned rules still disable Resume/Delete (with reason) but keep Duplicate, even for Admin.

test.describe('Admin (RBAC-A)', () => {
  test('RBAC-A: Admin can reach both active rule pages and both Recently deleted tabs', async ({ page }) => {
    await page.goto('/alerting/rules/alert');
    await expect(page.getByRole('heading', { name: 'Alert rules' })).toBeVisible();

    await page.getByRole('tab', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted/);
    await expect(page.getByRole('tab', { name: 'Recently deleted', selected: true })).toBeVisible();

    await page.goto('/alerting/rules/recording');
    await expect(page.getByRole('heading', { name: 'Recording rules' })).toBeVisible();

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
    await markProvisioned(page.request, 'alertrules', provisionedUid);
    const list = new RuleListPage(page, 'alert');

    await list.goto(folderScope(folder.uid));

    await expect(page.getByRole('link', { name: normalTitle })).toBeVisible();
    await list.rowMoreButton(normalTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Resume', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('link', { name: provisionedTitle })).toBeVisible();
    await list.rowMoreButton(provisionedTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
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
    await markProvisioned(page.request, 'recordingrules', provisionedUid);
    const list = new RuleListPage(page, 'recording');

    await list.goto(folderScope(folder.uid));

    await expect(page.getByRole('link', { name: normalTitle })).toBeVisible();
    await list.rowMoreButton(normalTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Resume', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('link', { name: provisionedTitle })).toBeVisible();
    await list.rowMoreButton(provisionedTitle).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicate', exact: true })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: /^(Pause|Resume): Provisioned$/ })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Delete: Provisioned', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
  });
});

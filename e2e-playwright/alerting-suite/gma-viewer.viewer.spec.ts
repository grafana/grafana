import { test, expect } from '@grafana/plugin-e2e';

import { RuleListPage } from './pages/RuleListPage';
import { runScope } from './ruleSeeding';
import { requireViewerFixtures } from './viewer-fixtures/viewerFixtureState';

test.describe('Viewer', () => {
  test('RBAC-V: opens the active pages but sees no Recently deleted tab', async ({ page }) => {
    await page.goto('/alerting/rules/alert');
    await expect(page.getByRole('heading', { name: 'Alert rules', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Alert rules' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveCount(0);

    await page.goto('/alerting/rules/recording');
    await expect(page.getByRole('heading', { name: 'Recording rules', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveCount(0);
  });

  test('RBAC-V: the Recently deleted route itself is inaccessible', async ({ page }) => {
    await page.goto('/alerting/rules/alert/deleted');
    await expect(page).not.toHaveURL(/\/alerting\/rules\/alert\/deleted/);
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  // Seeded as Admin before login: a later folder stays invisible until the 60 s role-permission cache refreshes.
  test('RBAC-V: sees readable rules without New rule buttons or any usable row mutation', async ({ page }) => {
    const { runMarker, alertRule, recordingRule } = requireViewerFixtures();

    for (const { kind, title, newRuleButton } of [
      { kind: 'alert', title: alertRule.title, newRuleButton: 'New alert rule' },
      { kind: 'recording', title: recordingRule.title, newRuleButton: 'New recording rule' },
    ] as const) {
      const list = new RuleListPage(page, kind);
      await list.goto(runScope(runMarker));

      const row = list.ruleRow(title);
      await expect(row).toBeVisible();
      await expect(page.getByRole('link', { name: newRuleButton })).toHaveCount(0);
      await expect(row.getByRole('link', { name: 'Edit' })).toHaveCount(0);
      await expect(row.getByRole('button', { name: /^Edit: /, disabled: true })).toBeVisible();

      await row.getByRole('button', { name: 'More', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /^(Pause|Resume|Delete)$/ })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: /^(Pause|Resume): /, disabled: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /^Delete: /, disabled: true })).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });
});

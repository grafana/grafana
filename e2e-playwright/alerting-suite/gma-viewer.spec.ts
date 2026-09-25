import { test, expect } from '@grafana/plugin-e2e';

import { gotoResilient } from './waitForAppLoad';

// Uses the `alerting-viewer` project (playwright.config.ts) — a Viewer-role user dedicated to
// this suite, distinct from the org-wide `viewer` project which belongs to plugin API tests.
test.describe('Viewer', () => {
  // See gma-stack-gate-and-old-link.spec.ts for why: this dev instance's rspack watcher
  // rebuilds on every concurrently-running agent's file change.
  test.slow();

  test('RBAC-V: opens the active pages but sees no Recently deleted tab', async ({ page }) => {
    await gotoResilient(page, '/alerting/rules/alert');
    await expect(page.getByRole('heading', { name: 'Alert rules', level: 1 })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('tab', { name: 'Alert rules' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveCount(0);

    await gotoResilient(page, '/alerting/rules/recording');
    await expect(page.getByRole('heading', { name: 'Recording rules', level: 1 })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveCount(0);
  });

  test('RBAC-V: the Recently deleted route itself is inaccessible', async ({ page }) => {
    await gotoResilient(page, '/alerting/rules/alert/deleted');
    // Route-level role gating redirects an unauthorized Viewer to the home dashboard rather
    // than rendering the deleted-rules table — assert the deleted page never appears.
    await expect(page).not.toHaveURL(/\/alerting\/rules\/alert\/deleted/, { timeout: 40_000 });
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});

import { expect } from '@grafana/plugin-e2e';

import { test, holdChunk, openShare } from './utils/dashboard-lazy-loading';

// The overview drawer belongs to the classic controls; new layouts use the sidebar pane.
const drawerTest = test.extend({
  featureToggles: [{ dashboardUnifiedDrilldownControls: true, dashboardNewLayouts: false }, { scope: 'worker' }],
  // The classic drawer conditionally calls useState after activation and crashes with early rendering.
  // Keep cancellation coverage independent of that existing hook-order bug.
  openFeature: [{ flags: { 'grafana.scenesFlickeringFix': false } }, { scope: 'worker' }],
});

drawerTest.describe('lazy drawers', { tag: '@drawer-request' }, () => {
  drawerTest('Filters overview opens and can be closed and reopened', async ({ page, dashboardPath }) => {
    await page.goto(dashboardPath);
    await page.getByTestId('filters-overview-expand').click();
    await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
    await expect(page.getByText('environment', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('production', { exact: true }).last()).toBeVisible();
    await page.getByTestId('data-testid Drawer close').click();
    await expect(page.getByText('Edit filters', { exact: true })).toBeHidden();
    await page.getByTestId('filters-overview-expand').click();
    await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
  });

  for (const transition of ['share', 'enter edit mode', 'navigate away and back'] as const) {
    drawerTest(`pending Filters drawer cannot undo ${transition}`, async ({ page, dashboardPath }) => {
      const held = await holdChunk(page, /\/dashboard-filters-overview\.[^/]+\.js$/);
      await page.goto(dashboardPath);
      await page.getByTestId('filters-overview-expand').click();
      await held.wait();

      if (transition === 'share') {
        await openShare(page);
        await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
      } else if (transition === 'enter edit mode') {
        await page.getByTestId('data-testid Edit dashboard button').click();
        await expect(page.getByRole('button', { name: 'Exit edit', exact: true })).toBeVisible();
      } else {
        await page
          .getByRole('navigation', { name: 'Breadcrumbs' })
          .getByRole('link', { name: 'Dashboards', exact: true })
          .click();
        await expect(page).toHaveURL(/\/dashboards(?:\?|$)/);
        await page.goBack();
        await expect(page.getByText('Browser review content')).toBeVisible();
      }

      await held.release();
      await expect(page.getByText('Edit filters', { exact: true })).toBeHidden();
      if (transition === 'share') {
        await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
        await page.getByTestId('data-testid Drawer close').click();
      } else if (transition === 'enter edit mode') {
        await expect(page.getByRole('button', { name: 'Exit edit', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Exit edit', exact: true }).click();
      }

      // Cancellation must not poison the cached chunk or prevent a later explicit request.
      await page.getByTestId('filters-overview-expand').click();
      await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
      await expect(page.getByText('production', { exact: true }).last()).toBeVisible();
    });
  }
});

import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    queryHistoryLocalOnly: true,
  },
  openFeature: {
    flags: {
      queryHistoryRecentQueriesUI: true,
    },
  },
});

test.describe(
  'Recent Queries',
  {
    tag: ['@various'],
  },
  () => {
    test('should open modal and display a recently run query', async ({ page, selectors, dashboardPage }) => {
      await page.goto('/explore');

      // Wait for Explore to load
      const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
      await expect(exploreContainer).toBeVisible();

      // Run a query using the default test datasource
      const runButton = dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);
      await runButton.click();

      // Wait for query results to appear
      await expect(page.locator('[data-testid="explore-dataplane"]')).toBeVisible({ timeout: 10_000 });

      // Click the Recent queries button
      const recentQueriesButton = page.getByRole('button', { name: 'Recent queries' });
      await expect(recentQueriesButton).toBeVisible();
      await recentQueriesButton.click();

      // Modal should open
      const modal = page.getByRole('dialog', { name: 'Recent queries' });
      await expect(modal).toBeVisible();

      // Should contain at least one query row from the query we just ran
      const queryRows = modal.locator('[class*="queryRow"], [class*="QueryRow"], tr, [role="row"]');
      await expect(queryRows.first()).toBeVisible({ timeout: 5_000 });
    });
  }
);

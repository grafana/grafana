import { test, expect } from '@grafana/plugin-e2e';

test.use({
  openFeature: {
    flags: {
      'queryHistory.localOnly': true,
      'queryHistory.recentQueriesUI': false,
    },
  },
});

test('should show Query history button and hide Recent queries button', async ({ page, selectors, dashboardPage }) => {
  await page.goto('/explore');

  const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
  await expect(exploreContainer).toBeVisible();

  await expect(page.getByRole('button', { name: 'Query history' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recent queries' })).not.toBeVisible();
});

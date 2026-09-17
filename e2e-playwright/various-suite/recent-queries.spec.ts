import { type Locator, type Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

type Fixtures = Parameters<Parameters<typeof test>[2]>[0];

test.use({
  featureToggles: {
    queryLibrary: false,
  },
  openFeature: {
    flags: {
      'queryHistory.localOnly': true,
      'queryHistory.recentQueriesUI': true,
    },
  },
});

async function runQueryAndWaitForResults(
  page: Page,
  dashboardPage: Fixtures['dashboardPage'],
  selectors: Fixtures['selectors']
) {
  const queryResponse = page.waitForResponse((resp) => resp.url().includes('/api/ds/query') && resp.status() === 200);
  const runButton = dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);
  await runButton.click();
  await queryResponse;
}

async function openRecentQueriesModal(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Recent queries' }).click();
  const modal = page.getByRole('dialog', { name: 'Recent queries' });
  await expect(modal).toBeVisible();
  return modal;
}

test('should show Recent queries button alongside Query history button', async ({ page, selectors, dashboardPage }) => {
  await page.goto('/explore');

  const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
  await expect(exploreContainer).toBeVisible();

  // The Query history button is intentionally kept visible during the deprecation period,
  // even when the recentQueriesUI flag is enabled.
  await expect(page.getByRole('button', { name: 'Recent queries' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Query history' })).toBeVisible();
});

test('should open modal and display a recently run query', async ({ page, selectors, dashboardPage }) => {
  await page.goto('/explore');

  const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
  await expect(exploreContainer).toBeVisible();

  await runQueryAndWaitForResults(page, dashboardPage, selectors);

  const modal = await openRecentQueriesModal(page);
  await expect(modal.locator('[data-testid="recent-query-row"]').first()).toBeVisible({ timeout: 5_000 });
});

test('should star a query and persist it across modal reopens', async ({ page, selectors, dashboardPage }) => {
  await page.goto('/explore');

  const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
  await expect(exploreContainer).toBeVisible();

  await runQueryAndWaitForResults(page, dashboardPage, selectors);

  // Open modal and star the first query
  let modal = await openRecentQueriesModal(page);
  const row = modal.locator('[data-testid="recent-query-row"]').first();
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.getByRole('button', { name: 'Star' }).click();

  // Close and reopen the modal
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).not.toBeVisible();

  modal = await openRecentQueriesModal(page);
  const starredRow = modal.locator('[data-testid="recent-query-row"]').first();
  await expect(starredRow).toBeVisible({ timeout: 5_000 });
  await expect(starredRow.getByRole('button', { name: 'Unstar' })).toBeVisible();
});

test('should filter queries by search text', async ({ page, selectors, dashboardPage }) => {
  await page.goto('/explore');

  const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
  await expect(exploreContainer).toBeVisible();

  await runQueryAndWaitForResults(page, dashboardPage, selectors);

  const modal = await openRecentQueriesModal(page);
  await expect(modal.locator('[data-testid="recent-query-row"]').first()).toBeVisible({ timeout: 5_000 });

  // Type a search string that won't match any query
  const searchInput = modal.getByPlaceholder('Search by...');
  await searchInput.fill('zzz_no_match_zzz');

  await expect(modal.locator('[data-testid="recent-query-row"]')).toHaveCount(0);
});

test('should filter to show only starred queries', async ({ page, selectors, dashboardPage }) => {
  await page.goto('/explore');

  const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
  await expect(exploreContainer).toBeVisible();

  await runQueryAndWaitForResults(page, dashboardPage, selectors);

  const modal = await openRecentQueriesModal(page);
  const rows = modal.locator('[data-testid="recent-query-row"]');
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });

  // Toggle starred filter — no queries are starred yet so list should be empty
  const starredRadio = modal.getByRole('radio', { name: 'Starred queries' });
  await starredRadio.click();

  await expect(rows).toHaveCount(0);
});

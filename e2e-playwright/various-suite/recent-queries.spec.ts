import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Recent Queries',
  {
    tag: ['@various'],
  },
  () => {
    test.describe('with recentQueriesUI enabled', () => {
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

      test('should show Recent queries button and hide Query history button', async ({
        page,
        selectors,
        dashboardPage,
      }) => {
        await page.goto('/explore');

        const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
        await expect(exploreContainer).toBeVisible();

        await expect(page.getByRole('button', { name: 'Recent queries' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Query history' })).not.toBeVisible();
      });

      test('should open modal and display a recently run query', async ({ page, selectors, dashboardPage }) => {
        await page.goto('/explore');

        const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
        await expect(exploreContainer).toBeVisible();

        const runButton = dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);
        await runButton.click();

        await expect(page.locator('[data-testid="explore-dataplane"]')).toBeVisible({ timeout: 10_000 });

        const recentQueriesButton = page.getByRole('button', { name: 'Recent queries' });
        await recentQueriesButton.click();

        const modal = page.getByRole('dialog', { name: 'Recent queries' });
        await expect(modal).toBeVisible();

        const queryRows = modal.locator('[class*="queryRow"], [class*="QueryRow"], tr, [role="row"]');
        await expect(queryRows.first()).toBeVisible({ timeout: 5_000 });
      });
    });

    test.describe('with recentQueriesUI disabled (default)', () => {
      test.use({
        featureToggles: {
          queryHistoryLocalOnly: true,
        },
        openFeature: {
          flags: {
            queryHistoryRecentQueriesUI: false,
          },
        },
      });

      test('should show Query history button and hide Recent queries button', async ({
        page,
        selectors,
        dashboardPage,
      }) => {
        await page.goto('/explore');

        const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
        await expect(exploreContainer).toBeVisible();

        await expect(page.getByRole('button', { name: 'Query history' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Recent queries' })).not.toBeVisible();
      });
    });
  }
);

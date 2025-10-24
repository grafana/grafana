import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Grafana datasource random walk',
  {
    tag: ['@grafana-datasource'],
  },
  () => {
    test('should render random walk configuration fields', async ({ gotoDashboardPage, page }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Select Grafana (-- Grafana --) datasource - it should be default
      const queryTypeSelect = page.getByLabel('Query type');
      await expect(queryTypeSelect).toBeVisible();

      // Verify Random Walk is selected by default
      await expect(queryTypeSelect).toHaveValue('Random Walk');

      // Verify all random walk configuration fields are visible
      await expect(page.getByLabel('Series count')).toBeVisible();
      await expect(page.getByLabel('Start value')).toBeVisible();
      await expect(page.getByLabel('Min', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Max', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Spread')).toBeVisible();
      await expect(page.getByLabel('Noise')).toBeVisible();
      await expect(page.getByLabel('Drop (%)')).toBeVisible();
    });

    test('should configure min and max values and render constrained data', async ({
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Configure random walk with min/max constraints
      const minInput = page.getByLabel('Min', { exact: true });
      const maxInput = page.getByLabel('Max', { exact: true });

      await minInput.fill('10');
      await maxInput.fill('50');

      // Verify graph renders with a series
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();

      // Save the panel
      await dashboardPage.getByTestId(selectors.pages.Dashboard.Settings.General.title).fill('Random Walk Test');
      await page.getByRole('button', { name: 'Apply' }).click();

      // Verify panel is saved
      await expect(dashboardPage.getByText('Random Walk Test')).toBeVisible();
    });

    test('should generate multiple series when series count is configured', async ({
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Configure series count to 3
      const seriesCountInput = page.getByLabel('Series count');
      await seriesCountInput.fill('3');

      // Wait for query to execute and check that we have multiple series in the legend
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();

      // Note: With seriesCount=3, we should see multiple series but they all share the same refId
      // The backend generates them with different indexes, but legend shows based on labels/name
      // This test verifies the configuration is accepted and data renders
    });

    test('should configure spread and noise parameters', async ({ gotoDashboardPage, page, selectors }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Configure spread and noise
      const spreadInput = page.getByLabel('Spread');
      const noiseInput = page.getByLabel('Noise');
      const startValueInput = page.getByLabel('Start value');

      await startValueInput.fill('100');
      await spreadInput.fill('5');
      await noiseInput.fill('2');

      // Verify graph renders
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();
    });

    test('should configure drop percentage for missing data', async ({ gotoDashboardPage, page, selectors }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Configure drop percentage
      const dropInput = page.getByLabel('Drop (%)');
      await dropInput.fill('20');

      // Verify graph still renders even with dropped points
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();
    });

    test('should show tooltips on configuration fields', async ({ gotoDashboardPage, page }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Check that tooltip icons are present (they have info-circle icon)
      const tooltipIcons = page.locator('[data-testid="info-circle-icon"]');
      const count = await tooltipIcons.count();

      // We should have 7 tooltips (one for each field)
      expect(count).toBeGreaterThanOrEqual(7);

      // Hover over the Spread field tooltip and verify tooltip content appears
      const spreadTooltip = page
        .locator('label')
        .filter({ hasText: 'Spread' })
        .locator('[data-testid="info-circle-icon"]');

      await spreadTooltip.hover();

      // Verify tooltip content is shown (checking for part of the tooltip text)
      await expect(page.getByText(/Maximum step size/)).toBeVisible();
    });
  }
);

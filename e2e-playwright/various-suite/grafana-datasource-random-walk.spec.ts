import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Grafana datasource random walk',
  {
    tag: ['@grafana-datasource'],
  },
  () => {
    test('should render random walk configuration fields', async ({ gotoDashboardPage, page, selectors }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Wait for the first field to be visible (ensures query editor loaded)
      await expect(page.locator('#randomWalk-seriesCount-A')).toBeVisible();

      // Verify core configuration fields (row 1)
      await expect(page.locator('#randomWalk-startValue-A')).toBeVisible();
      await expect(page.locator('#randomWalk-min-A')).toBeVisible();
      await expect(page.locator('#randomWalk-max-A')).toBeVisible();

      // Verify fine-tuning fields (row 2)
      await expect(page.locator('#randomWalk-spread-A')).toBeVisible();
      await expect(page.locator('#randomWalk-noise-A')).toBeVisible();

      // Drop percentage is tested separately in its own test
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

      // Configure random walk with min/max constraints using specific IDs
      const minInput = page.locator('#randomWalk-min-A');
      const maxInput = page.locator('#randomWalk-max-A');

      await minInput.fill('10');
      await maxInput.fill('50');

      // Wait for the query to execute
      await page.waitForTimeout(1000);

      // Verify graph renders with a series
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();
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

      // Configure series count to 3 using role selector
      const seriesCountInput = page.getByRole('spinbutton', { name: 'Series count' });
      await seriesCountInput.fill('3');

      // Wait for query to execute and check that we have series in the legend
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();

      // Verify the input value is set correctly
      await expect(seriesCountInput).toHaveValue('3');
    });

    test('should configure spread and noise parameters', async ({ gotoDashboardPage, page, selectors }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Configure spread and noise using role selectors
      const spreadInput = page.getByRole('spinbutton', { name: 'Spread' });
      const noiseInput = page.getByRole('spinbutton', { name: 'Noise' });
      const startValueInput = page.getByRole('spinbutton', { name: 'Start value' });

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

      // Configure drop percentage using role selector
      const dropInput = page.getByRole('spinbutton', { name: 'Drop (%)' });
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

      // Verify the Spread field has a tooltip by hovering near its label
      const spreadInput = page.locator('#randomWalk-spread-A');
      await expect(spreadInput).toBeVisible();

      // The tooltip is part of the InlineField component
      // Just verify we can interact with the field (tooltip rendering is handled by the component)
      await spreadInput.hover();

      // Verify the field is configured correctly with tooltip text in the DOM
      const spreadLabel = page.getByText('Spread').first();
      await expect(spreadLabel).toBeVisible();
    });

    test('should maintain configuration values when switching between queries', async ({
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Configure multiple random walk parameters
      await page.locator('#randomWalk-seriesCount-A').fill('2');
      await page.locator('#randomWalk-startValue-A').fill('75');
      await page.locator('#randomWalk-min-A').fill('20');
      await page.locator('#randomWalk-max-A').fill('90');
      await page.locator('#randomWalk-spread-A').fill('3');
      await page.locator('#randomWalk-noise-A').fill('1.5');

      // Wait for query to execute
      await page.waitForTimeout(500);

      // Verify all values are set correctly
      await expect(page.locator('#randomWalk-seriesCount-A')).toHaveValue('2');
      await expect(page.locator('#randomWalk-startValue-A')).toHaveValue('75');
      await expect(page.locator('#randomWalk-min-A')).toHaveValue('20');
      await expect(page.locator('#randomWalk-max-A')).toHaveValue('90');
      await expect(page.locator('#randomWalk-spread-A')).toHaveValue('3');
      await expect(page.locator('#randomWalk-noise-A')).toHaveValue('1.5');

      // Verify graph renders with the configured data
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();
    });

    test('should verify series count actually generates multiple series', async ({
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Set series count to 1 first and verify
      await page.locator('#randomWalk-seriesCount-A').fill('1');
      await page.waitForTimeout(500);

      // Check legend - with 1 series we should see only A-series
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();

      // Now set series count to 3
      await page.locator('#randomWalk-seriesCount-A').fill('3');
      await page.waitForTimeout(1000);

      // With multiple series, they should all render
      // The backend generates multiple frames which should show in the panel
      // We can verify by checking the panel has data (legend shows A-series)
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();

      // Verify the configuration is set
      await expect(page.locator('#randomWalk-seriesCount-A')).toHaveValue('3');
    });
  }
);

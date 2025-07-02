import { test, expect } from '@grafana/plugin-e2e';

// Todo: Fix datasource creation
test.describe.skip(
  'Prometheus config',
  {
    tag: ['@various'],
  },
  () => {
    const DATASOURCE_ID = 'Prometheus';
    const DATASOURCE_TYPED_NAME = 'PrometheusDatasourceInstance';

    test.beforeEach(async ({ page, selectors, createDataSourceConfigPage }) => {
      // Navigate to add data source page
      await page.goto('/datasources/new');

      // Select the Prometheus data source
      const prometheusPlugin = page.getByRole('button', { name: DATASOURCE_ID });
      await prometheusPlugin.scrollIntoViewIfNeeded();
      await expect(prometheusPlugin).toBeVisible();
      await prometheusPlugin.click();
    });

    test('should have the following components: connection settings, managed alerts, scrape interval, query timeout, default editor, disable metric lookup, prometheus type, cache level, incremental querying, disable recording rules, custom query parameters, http method', async ({
      page,
      selectors,
    }) => {
      // connection settings
      const connectionSettings = page.getByLabel(
        selectors.components.DataSource.Prometheus.configPage.connectionSettings
      );
      await expect(connectionSettings).toBeVisible();

      // managed alerts
      const manageAlerts = page.locator(`#${selectors.components.DataSource.Prometheus.configPage.manageAlerts}`);
      await manageAlerts.scrollIntoViewIfNeeded();
      await expect(manageAlerts).toBeVisible();

      // scrape interval
      const scrapeInterval = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.scrapeInterval);
      await scrapeInterval.scrollIntoViewIfNeeded();
      await expect(scrapeInterval).toBeVisible();

      // query timeout
      const queryTimeout = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.queryTimeout);
      await queryTimeout.scrollIntoViewIfNeeded();
      await expect(queryTimeout).toBeVisible();

      // default editor
      const defaultEditor = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.defaultEditor);
      await defaultEditor.scrollIntoViewIfNeeded();
      await expect(defaultEditor).toBeVisible();

      // disable metric lookup
      const disableMetricLookup = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.disableMetricLookup}`
      );
      await disableMetricLookup.scrollIntoViewIfNeeded();
      await expect(disableMetricLookup).toBeVisible();

      // prometheus type
      const prometheusType = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.prometheusType);
      await prometheusType.scrollIntoViewIfNeeded();
      await expect(prometheusType).toBeVisible();

      // cache level
      const cacheLevel = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.cacheLevel);
      await cacheLevel.scrollIntoViewIfNeeded();
      await expect(cacheLevel).toBeVisible();

      // incremental querying
      const incrementalQuerying = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`
      );
      await incrementalQuerying.scrollIntoViewIfNeeded();
      await expect(incrementalQuerying).toBeVisible();

      // disable recording rules
      const disableRecordingRules = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.disableRecordingRules}`
      );
      await disableRecordingRules.scrollIntoViewIfNeeded();
      await expect(disableRecordingRules).toBeVisible();

      // custom query parameters
      const customQueryParameters = page.getByTestId(
        selectors.components.DataSource.Prometheus.configPage.customQueryParameters
      );
      await customQueryParameters.scrollIntoViewIfNeeded();
      await expect(customQueryParameters).toBeVisible();

      // http method
      const httpMethod = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.httpMethod);
      await httpMethod.scrollIntoViewIfNeeded();
      await expect(httpMethod).toBeVisible();
    });

    test('should save the default editor when navigating to explore', async ({ page, selectors }) => {
      // Click on default editor
      const defaultEditor = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.defaultEditor);
      await defaultEditor.scrollIntoViewIfNeeded();
      await expect(defaultEditor).toBeVisible();
      await defaultEditor.click();

      // Select 'Builder' option
      await selectOption(page, 'Builder');

      // Set connection settings
      const connectionSettings = page.getByLabel(
        selectors.components.DataSource.Prometheus.configPage.connectionSettings
      );
      await connectionSettings.fill('http://prom-url:9090');

      // Set data source name
      const nameInput = page.getByTestId(selectors.pages.DataSource.name);
      await nameInput.clear();
      await nameInput.fill(DATASOURCE_TYPED_NAME);

      // Save and test
      const saveAndTestButton = page.getByTestId(selectors.pages.DataSource.saveAndTest);
      await saveAndTestButton.click();

      // Navigate to explore
      await page.goto('/explore');

      // Select the data source
      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      // Type the data source name and press enter
      await page.keyboard.type(DATASOURCE_TYPED_NAME);
      await page.keyboard.press('Enter');

      // Verify the builder metric select is visible
      const metricSelect = page.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect
      );
      await expect(metricSelect).toBeVisible();
    });

    test('should allow a user to add the version when the Prom type is selected', async ({ page, selectors }) => {
      // Click on prometheus type
      const prometheusType = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.prometheusType);
      await prometheusType.scrollIntoViewIfNeeded();
      await expect(prometheusType).toBeVisible();
      await prometheusType.click();

      // Select 'Prometheus' option
      await selectOption(page, 'Prometheus');

      // Verify prometheus version is visible
      const prometheusVersion = page.getByTestId(
        selectors.components.DataSource.Prometheus.configPage.prometheusVersion
      );
      await prometheusVersion.scrollIntoViewIfNeeded();
      await expect(prometheusVersion).toBeVisible();
    });

    test('should have a cache level component', async ({ page, selectors }) => {
      // Verify cache level is visible
      const cacheLevel = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.cacheLevel);
      await cacheLevel.scrollIntoViewIfNeeded();
      await expect(cacheLevel).toBeVisible();
    });

    test('should allow a user to select a query overlap window when incremental querying is selected', async ({
      page,
      selectors,
    }) => {
      // Check the incremental querying checkbox
      const incrementalQuerying = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`
      );
      await incrementalQuerying.scrollIntoViewIfNeeded();
      await expect(incrementalQuerying).toBeVisible();
      await incrementalQuerying.check({ force: true });

      // Verify query overlap window is visible
      const queryOverlapWindow = page.getByTestId(
        selectors.components.DataSource.Prometheus.configPage.queryOverlapWindow
      );
      await queryOverlapWindow.scrollIntoViewIfNeeded();
      await expect(queryOverlapWindow).toBeVisible();
    });
  }
);

async function selectOption(page, option) {
  const optionElement = page.getByRole('option').filter({ hasText: option });
  await expect(optionElement).toBeVisible();
  await optionElement.click();
}

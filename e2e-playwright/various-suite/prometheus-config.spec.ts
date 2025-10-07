import { Page } from 'playwright-core';

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Prometheus config',
  {
    tag: ['@various'],
  },
  () => {
    const DATASOURCE_PREFIX = 'PrometheusConfig';

    test('should have the following components: connection settings, managed alerts, scrape interval, query timeout, default editor, disable metric lookup, prometheus type, cache level, incremental querying, disable recording rules, custom query parameters, http method', async ({
      page,
      selectors,
      createDataSourceConfigPage,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      const configPage = await createDataSourceConfigPage({
        type: 'prometheus',
        name: DATASOURCE_NAME,
      });
      // connection settings
      const connectionSettings = page.getByLabel(
        selectors.components.DataSource.Prometheus.configPage.connectionSettings
      );
      await expect(connectionSettings).toBeVisible();

      // managed alerts
      const manageAlerts = page.locator(`#${selectors.components.DataSource.Prometheus.configPage.manageAlerts}`);
      await expect(manageAlerts).toBeVisible();

      // scrape interval
      const scrapeInterval = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.scrapeInterval
      );
      await expect(scrapeInterval).toBeVisible();

      // query timeout
      const queryTimeout = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.queryTimeout
      );
      await expect(queryTimeout).toBeVisible();

      // default editor
      const defaultEditor = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.defaultEditor
      );
      await expect(defaultEditor).toBeVisible();

      // disable metric lookup
      const disableMetricLookup = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.disableMetricLookup}`
      );
      await expect(disableMetricLookup).toBeVisible();

      // prometheus type
      const prometheusType = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.prometheusType
      );
      await expect(prometheusType).toBeVisible();

      // cache level
      const cacheLevel = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.cacheLevel
      );
      await expect(cacheLevel).toBeVisible();

      // incremental querying
      const incrementalQuerying = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`
      );
      await expect(incrementalQuerying).toBeVisible();

      // disable recording rules
      const disableRecordingRules = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.disableRecordingRules}`
      );
      await expect(disableRecordingRules).toBeVisible();

      // custom query parameters
      const customQueryParameters = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.customQueryParameters
      );
      await expect(customQueryParameters).toBeVisible();

      // http method
      const httpMethod = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.httpMethod
      );
      await expect(httpMethod).toBeVisible();
    });

    test('should save the default editor when navigating to explore', async ({
      createDataSourceConfigPage,
      explorePage,
      page,
      selectors,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      const configPage = await createDataSourceConfigPage({
        type: 'prometheus',
        name: DATASOURCE_NAME,
      });

      // Click on default editor
      const defaultEditor = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.defaultEditor
      );
      await expect(defaultEditor).toBeVisible();
      await defaultEditor.click();

      // Select 'Builder' option
      await selectOption(page, 'Builder');

      // Set connection settings
      const connectionSettings = page.getByLabel(
        selectors.components.DataSource.Prometheus.configPage.connectionSettings
      );
      await connectionSettings.fill('http://prom-url:9090');

      // Save and test
      const saveAndTestButton = configPage.getByGrafanaSelector(selectors.pages.DataSource.saveAndTest);
      await saveAndTestButton.click();

      // Navigate to explore
      await explorePage.goto();

      // Select the data source
      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      // Type the data source name and press enter
      await page.keyboard.type(DATASOURCE_NAME);
      await page.keyboard.press('Enter');

      // Verify the builder metric select is visible
      const metricSelect = page.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect
      );
      await expect(metricSelect).toBeVisible();
    });

    test('should allow a user to add the version when the Prom type is selected', async ({
      createDataSourceConfigPage,
      page,
      selectors,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      const configPage = await createDataSourceConfigPage({
        type: 'prometheus',
        name: DATASOURCE_NAME,
      });

      // Click on prometheus type
      const prometheusType = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.prometheusType
      );
      await expect(prometheusType).toBeVisible();
      await prometheusType.click();

      // Select 'Prometheus' option
      await selectOption(page, 'Prometheus');

      // Verify prometheus version is visible
      const prometheusVersion = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.prometheusVersion
      );
      await expect(prometheusVersion).toBeVisible();
    });

    test('should have a cache level component', async ({ createDataSourceConfigPage, page, selectors }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      const configPage = await createDataSourceConfigPage({
        type: 'prometheus',
        name: DATASOURCE_NAME,
      });

      // Verify cache level is visible
      const cacheLevel = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.cacheLevel
      );
      await expect(cacheLevel).toBeVisible();
    });

    test('should allow a user to select a query overlap window when incremental querying is selected', async ({
      createDataSourceConfigPage,
      page,
      selectors,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      const configPage = await createDataSourceConfigPage({
        type: 'prometheus',
        name: DATASOURCE_NAME,
      });

      // Check the incremental querying checkbox
      const incrementalQuerying = page.locator(
        `#${selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}`
      );
      await expect(incrementalQuerying).toBeVisible();
      await incrementalQuerying.check({ force: true });

      // Verify query overlap window is visible
      const queryOverlapWindow = configPage.getByGrafanaSelector(
        selectors.components.DataSource.Prometheus.configPage.queryOverlapWindow
      );
      await expect(queryOverlapWindow).toBeVisible();
    });
  }
);

async function selectOption(page: Page, option: string) {
  const optionElement = page.getByRole('option').filter({ hasText: option });
  await expect(optionElement).toBeVisible();
  await optionElement.click();
}

import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups } from '@grafana/plugin-e2e';

import { getResources } from '../utils/prometheus-helpers';

// TODO: fix some tests. Race conditions with other tests in the file cause some to fail.
test.describe.skip(
  'Prometheus query editor',
  {
    tag: ['@various', '@wip'],
  },
  () => {
    const DATASOURCE_ID = 'Prometheus';

    type EditorType = 'Code' | 'Builder';

    /**
     * Create and save a Prometheus data source, navigate to code or builder
     */
    async function navigateToEditor(page: Page, selectors: E2ESelectorGroups, editorType: string, name: string) {
      // Navigate to add data source page
      await page.goto('/datasources/new');

      // Select the Prometheus data source
      const prometheusPlugin = page.getByRole('button', { name: DATASOURCE_ID });
      await prometheusPlugin.scrollIntoViewIfNeeded();
      await expect(prometheusPlugin).toBeVisible();
      await prometheusPlugin.click();

      // Choose default editor
      const defaultEditor = page.getByTestId(selectors.components.DataSource.Prometheus.configPage.defaultEditor);
      await defaultEditor.scrollIntoViewIfNeeded();
      await expect(defaultEditor).toBeVisible();
      await defaultEditor.click();

      await selectOption(page, editorType, selectors);

      // Add URL for DS to save without error
      const connectionSettings = page.getByLabel(
        selectors.components.DataSource.Prometheus.configPage.connectionSettings
      );
      await connectionSettings.fill('http://prom-url:9090');

      // Name the DS
      const nameInput = page.getByTestId(selectors.pages.DataSource.name);
      await nameInput.clear();
      await nameInput.fill(name);

      const saveAndTestButton = page.getByTestId(selectors.pages.DataSource.saveAndTest);
      await saveAndTestButton.click();

      // Visit explore
      await page.goto('/explore');

      // Choose the right DS
      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      const dataSourceOption = page.getByRole('button', { name: `${name} ${DATASOURCE_ID}`, exact: true });
      await dataSourceOption.scrollIntoViewIfNeeded();
      await expect(dataSourceOption).toBeVisible();
      await dataSourceOption.click();
    }

    test('should have a kickstart component', async ({ page, selectors }) => {
      await navigateToEditor(page, selectors, 'Code', 'prometheus');

      const queryPatterns = page.getByTestId(selectors.components.QueryBuilder.queryPatterns);
      await queryPatterns.scrollIntoViewIfNeeded();
      await expect(queryPatterns).toBeVisible();
    });

    test('should have an explain component', async ({ page, selectors }) => {
      await navigateToEditor(page, selectors, 'Code', 'prometheus');

      const explain = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.explain);
      await explain.scrollIntoViewIfNeeded();
      await expect(explain).toBeVisible();
    });

    test('should have an editor toggle component', async ({ page, selectors }) => {
      await navigateToEditor(page, selectors, 'Code', 'prometheus');

      const editorToggle = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.editorToggle);
      await editorToggle.scrollIntoViewIfNeeded();
      await expect(editorToggle).toBeVisible();
    });

    test('should have an options component with legend, format, step, type and exemplars', async ({
      page,
      selectors,
    }) => {
      await navigateToEditor(page, selectors, 'Code', 'prometheus');

      // Open options
      const options = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.options);
      await options.scrollIntoViewIfNeeded();
      await expect(options).toBeVisible();
      await options.click();

      // Check options
      const legend = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.legend);
      await legend.scrollIntoViewIfNeeded();
      await expect(legend).toBeVisible();

      const format = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.format);
      await format.scrollIntoViewIfNeeded();
      await expect(format).toBeVisible();

      const step = page.locator('[data-test-id="prometheus-step"]');
      await step.scrollIntoViewIfNeeded();
      await expect(step).toBeVisible();

      const type = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.type);
      await type.scrollIntoViewIfNeeded();
      await expect(type).toBeVisible();

      const exemplars = page.getByTestId('prometheus-exemplars');
      await exemplars.scrollIntoViewIfNeeded();
      await expect(exemplars).toBeVisible();
    });

    test.describe('Code editor', () => {
      test('navigates to the code editor with editor type as code', async ({ page, selectors }) => {
        await navigateToEditor(page, selectors, 'Code', 'prometheusCode');
      });

      test('navigates to the code editor and opens the metrics browser with metric search, labels, label values, and all components', async ({
        page,
        selectors,
      }) => {
        await navigateToEditor(page, selectors, 'Code', 'prometheusCode');

        await getResources(page);

        const queryField = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.code.queryField);
        await expect(queryField).toBeVisible();

        const metricsBrowserButton = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.openButton
        );
        await metricsBrowserButton.click();

        const selectMetric = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric
        );
        await expect(selectMetric).toBeVisible();

        const labelNamesFilter = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelNamesFilter
        );
        await expect(labelNamesFilter).toBeVisible();

        const labelValuesFilter = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelValuesFilter
        );
        await expect(labelValuesFilter).toBeVisible();

        const useQuery = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery
        );
        await expect(useQuery).toBeVisible();

        const useAsRateQuery = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useAsRateQuery
        );
        await expect(useAsRateQuery).toBeVisible();

        const validateSelector = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.validateSelector
        );
        await expect(validateSelector).toBeVisible();

        const clear = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.clear
        );
        await expect(clear).toBeVisible();
      });

      test('selects a metric in the metrics browser and uses the query', async ({ page, selectors }) => {
        await navigateToEditor(page, selectors, 'Code', 'prometheusCode');

        await getResources(page);

        const metricsBrowserButton = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.openButton
        );
        await metricsBrowserButton.click();

        const selectMetric = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric
        );
        await expect(selectMetric).toBeVisible();
        await selectMetric.fill('met');

        const metricList = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.metricList
        );
        await expect(metricList).toBeVisible();

        const metricOption = metricList.getByText('metric1');
        await expect(metricOption).toBeVisible();
        await metricOption.click();

        const useQuery = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery
        );
        await expect(useQuery).toBeVisible();
        await useQuery.click();

        const queryField = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.code.queryField);
        await expect(queryField).toBeVisible();
        await expect(queryField).toContainText('metric1');
      });
    });

    test.describe('Query builder', () => {
      test('navigates to the query builder with editor type as code', async ({ page, selectors }) => {
        await navigateToEditor(page, selectors, 'Builder', 'prometheusBuilder');
      });

      test('the query builder contains metric select, label filters and operations', async ({ page, selectors }) => {
        await navigateToEditor(page, selectors, 'Builder', 'prometheusBuilder');

        await getResources(page);

        const metricSelect = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect
        );
        await expect(metricSelect).toBeVisible();

        const labelSelect = page.getByTestId(selectors.components.QueryBuilder.labelSelect);
        await expect(labelSelect).toBeVisible();

        const matchOperatorSelect = page.getByTestId(selectors.components.QueryBuilder.matchOperatorSelect);
        await expect(matchOperatorSelect).toBeVisible();

        const valueSelect = page.getByTestId(selectors.components.QueryBuilder.valueSelect);
        await expect(valueSelect).toBeVisible();
      });

      test('can select a metric and provide a hint', async ({ page, selectors }) => {
        await navigateToEditor(page, selectors, 'Builder', 'prometheusBuilder');

        await getResources(page);

        const metricSelect = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect
        );
        await expect(metricSelect).toBeVisible();
        await metricSelect.click();

        await page.getByText('metric1').click();

        const hints = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.builder.hints);
        await expect(hints).toContainText('hint: add rate');
      });

      test('should have the metrics explorer opened via the metric select', async ({ page, selectors }) => {
        await navigateToEditor(page, selectors, 'Builder', 'prometheusBuilder');

        await getResources(page);

        const metricSelect = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect
        );
        await expect(metricSelect).toBeVisible();
        await metricSelect.click();

        await selectOption(page, 'Metrics explorer', selectors);

        const metricsExplorer = page.getByTestId(
          selectors.components.DataSource.Prometheus.queryEditor.builder.metricsExplorer
        );
        await expect(metricsExplorer).toBeVisible();
      });
    });
  }
);

async function selectOption(page: Page, option: string, selectors: E2ESelectorGroups) {
  const optionElement = page.getByTestId(selectors.components.Select.option).filter({ hasText: option });
  await expect(optionElement).toBeVisible();
  await optionElement.click();
}

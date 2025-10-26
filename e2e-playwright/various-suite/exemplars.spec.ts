import { Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Exemplars',
  {
    tag: ['@various'],
  },
  () => {
    const dataSourceName = 'PromExemplar';

    async function addDataSource(page, selectors, createDataSourceConfigPage) {
      // Navigate to add data source page
      await createDataSourceConfigPage({ type: 'prometheus', name: dataSourceName });

      // Add exemplars configuration
      const exemplarsAddButton = page.getByTestId(
        selectors.components.DataSource.Prometheus.configPage.exemplarsAddButton
      );
      await exemplarsAddButton.click();

      const internalLinkSwitch = page.getByTestId(
        selectors.components.DataSource.Prometheus.configPage.internalLinkSwitch
      );
      await internalLinkSwitch.check({ force: true });

      const connectionSettings = page.getByLabel(
        selectors.components.DataSource.Prometheus.configPage.connectionSettings
      );
      await connectionSettings.click();
      await page.keyboard.type('http://prom-url:9090');

      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await dataSourcePicker.click();

      const tempoOption = page.getByText('gdev-tempo');
      await tempoOption.scrollIntoViewIfNeeded();
      await expect(tempoOption).toBeVisible();
      await tempoOption.click();

      // Save the data source
      const saveAndTestButton = page.getByTestId(selectors.pages.DataSource.saveAndTest);
      await saveAndTestButton.click();
    }

    test.beforeEach(async ({ page, selectors, createDataSourceConfigPage }) => {
      await addDataSource(page, selectors, createDataSourceConfigPage);
      await page.goto('/');
    });

    test('should be able to navigate to configured data source', async ({ page, selectors }) => {
      // Mock API responses
      await page.route(/api\/ds\/query/, async (route) => {
        const postData = route.request().postDataJSON();
        const datasourceType = postData.queries[0].datasource.type;

        if (datasourceType === 'prometheus') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(require('../fixtures/exemplars-query-response.json')),
          });
        } else if (datasourceType === 'tempo') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(require('../fixtures/tempo-response.json')),
          });
        } else {
          await route.fulfill({ status: 200, body: '{}' });
        }
      });

      // Navigate to explore
      await page.goto('/explore');

      // Select data source
      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      const dataSourceOption = page.getByText(dataSourceName);
      await dataSourceOption.scrollIntoViewIfNeeded();
      await expect(dataSourceOption).toBeVisible();
      await dataSourceOption.click();

      // Switch to code editor
      const codeRadioButton = page.getByTestId(selectors.components.RadioButton.container).filter({ hasText: 'Code' });
      await codeRadioButton.click();

      // Wait for lazy loading Monaco
      await waitForMonacoToLoad(page);

      // Set time range
      const timePickerButton = page.getByTestId(selectors.components.TimePicker.openButton);
      await timePickerButton.click();

      const fromField = page.getByTestId(selectors.components.TimePicker.fromField);
      await fromField.clear();
      await fromField.fill('2021-07-10 17:10:00');

      const toField = page.getByTestId(selectors.components.TimePicker.toField);
      await toField.clear();
      await toField.fill('2021-07-10 17:30:00');

      const applyTimeRangeButton = page.getByTestId(selectors.components.TimePicker.applyTimeRange);
      await applyTimeRangeButton.click();

      // Type query
      const queryField = page.getByTestId(selectors.components.QueryField.container);
      await expect(queryField).toBeVisible();
      await queryField.click();
      await page.keyboard.type('exemplar-query_bucket');
      await page.keyboard.press('Shift+Enter');

      await page.waitForTimeout(1000);

      // Click zoom to data
      const zoomToDataButton = page.getByTestId('time-series-zoom-to-data');
      await zoomToDataButton.click();

      // Hover over exemplar marker and click
      const exemplarMarker = page.getByTestId(selectors.components.DataSource.Prometheus.exemplarMarker).first();
      await exemplarMarker.hover();

      const queryWithTempoLink = page.getByText('Query with gdev-tempo');
      await queryWithTempoLink.click();

      // Verify trace viewer has span bars
      const spanBars = page.getByTestId(selectors.components.TraceViewer.spanBar);
      await expect(spanBars).toHaveCount(11);
    });
  }
);

export async function waitForMonacoToLoad(page: Page) {
  // Wait for spinner to disappear
  const spinner = page.getByTestId('Spinner');
  await expect(spinner).toBeHidden();

  // Wait for Monaco to be available in window
  await page.waitForFunction(() => {
    return window.monaco !== undefined;
  });

  // Wait for Monaco editor textarea to exist
  const monacoTextarea = page.locator('.monaco-editor').first();
  await expect(monacoTextarea).toBeVisible();
}

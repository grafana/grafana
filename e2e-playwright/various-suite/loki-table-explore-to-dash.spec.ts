import { test, expect } from '@grafana/plugin-e2e';

const dataSourceName = 'LokiEditor';

const lokiQueryResult = {
  status: 'success',
  results: {
    A: {
      status: 200,
      frames: [
        {
          schema: {
            refId: 'A',
            meta: {
              typeVersion: [0, 0],
              custom: {
                frameType: 'LabeledTimeValues',
              },
              stats: [
                {
                  displayName: 'Summary: bytes processed per second',
                  unit: 'Bps',
                  value: 223921,
                },
                {
                  displayName: 'Summary: total bytes processed',
                  unit: 'decbytes',
                  value: 4156,
                },
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 0.01856,
                },
              ],
              executedQueryString: 'Expr: {targetLabelName="targetLabelValue"}',
            },
            fields: [
              {
                name: 'labels',
                type: 'other',
                typeInfo: {
                  frame: 'json.RawMessage',
                },
              },
              {
                name: 'Time',
                type: 'time',
                typeInfo: {
                  frame: 'time.Time',
                },
              },
              {
                name: 'Line',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                },
              },
              {
                name: 'tsNs',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                },
              },
              {
                name: 'id',
                type: 'string',
                typeInfo: {
                  frame: 'string',
                },
              },
            ],
          },
          data: {
            values: [
              [
                {
                  targetLabelName: 'targetLabelValue',
                  instance: 'server\\1',
                  job: '"grafana/data"',
                  nonIndexed: 'value',
                  place: 'moon',
                  re: 'one.two$three^four',
                  source: 'data',
                },
              ],
              [1700077283237],
              [
                '{"_entry":"log text with ANSI \\u001b[31mpart of the text\\u001b[0m [149702545]","counter":"22292","float":"NaN","wave":-0.5877852522916832,"label":"val3","level":"info"}',
              ],
              ['1700077283237000000'],
              ['1700077283237000000_9b025d35'],
            ],
          },
        },
      ],
    },
  },
};

test.use({
  featureToggles: {
    logsExploreTableVisualisation: true,
  },
});

test.describe(
  'Loki Query Editor',
  {
    tag: ['@various'],
  },
  () => {
    test('Should be able to add explore table to dashboard', async ({
      createDataSource,
      page,
      dashboardPage,
      selectors,
    }) => {
      await createDataSource({ type: 'loki', name: dataSourceName });
      // Mock API responses
      await page.route(/labels\?/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: ['instance', 'job', 'source'] }),
        });
      });

      await page.route(/series\?/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: [{ instance: 'instance1' }] }),
        });
      });

      await page.route(/\/api\/ds\/query\?ds_type=loki/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(lokiQueryResult),
        });
      });

      // Go to Explore and choose Loki data source
      await page.goto('/explore');
      await dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container).click();
      await page.getByRole('button', { name: dataSourceName }).click();

      await page.getByRole('radio', { name: 'Code' }).click();

      // Write a simple query
      const queryField = page.getByTestId(selectors.components.QueryField.container).locator('textarea');
      await queryField.fill('query{instance="instance1"}');

      // Submit the query with Shift+Enter
      await queryField.press('Shift+Enter');

      // Assert the no-data message is not visible
      await expect(page.locator('[data-testid="explore-no-data"]')).toBeHidden();

      // Click on the table toggle
      await page.getByRole('radio', { name: 'Table' }).click({ force: true });

      // One row with two cells initially
      const cells = page.locator('[role="gridcell"]');
      await expect(cells).toHaveCount(2);

      // Find and click on the targetLabelName label
      await page.getByText('targetLabelName', { exact: true }).click();

      // Now we should have a row with 3 columns
      await expect(cells).toHaveCount(3);
      // And a value of "targetLabelValue"
      await expect(cells.getByText('targetLabelValue')).toBeVisible();

      await page.getByLabel('Add', { exact: true }).click();

      await page.getByLabel('Add to dashboard').click();

      const addPanelToDashboardButton = page.getByText('Add panel to dashboard');
      await expect(addPanelToDashboardButton).toBeVisible();

      await page.getByText('Open dashboard').click();

      // Check the panel is visible
      const panel = page.locator('[data-viz-panel-key="panel-1"]');
      await expect(panel).toBeVisible();

      // Check the table cells in the panel
      const panelCells = panel.locator('[role="gridcell"]');
      // Should have 3 columns
      await expect(panelCells).toHaveCount(3);

      // Cells contain strings found in log line
      await expect(page.getByText('"wave":-0.5877852522916832')).toBeVisible();

      // Column has correct value of "targetLabelValue"
      await expect(panel.locator('[role="gridcell"]').filter({ hasText: 'targetLabelValue' })).toBeVisible();
    });
  }
);

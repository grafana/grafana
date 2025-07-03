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

// TODO: Fix the test. Most likely a datasource creation issue.
test.describe.skip(
  'Loki Query Editor',
  {
    tag: ['@various', '@wip'],
  },
  () => {
    test.beforeEach(async ({ page, createDataSourceConfigPage }) => {
      // Create the Loki datasource if it doesn't exist
      await createDataSourceConfigPage({ type: 'loki', name: dataSourceName });

      // Set feature toggle
      await page.evaluate(() => {
        localStorage.setItem('grafana.featureToggles', 'logsExploreTableVisualisation=1');
      });
    });

    test('Should be able to add explore table to dashboard', async ({ page, dashboardPage, selectors }) => {
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

      const dataSourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container);
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      const lokiDataSource = page.getByRole('button', { name: dataSourceName });
      await lokiDataSource.scrollIntoViewIfNeeded();
      await expect(lokiDataSource).toBeVisible();
      await lokiDataSource.click();

      // Click on Code mode
      const codeButton = page.getByRole('radio', { name: 'Code' });
      await codeButton.click({ force: true });

      // Wait for the query field to be ready and check placeholder text
      const queryField = page.locator('textarea');
      await expect(queryField).toBeVisible();

      // Write a simple query
      await queryField.fill('query{instance="instance1"}');

      // Submit the query with Shift+Enter
      await queryField.press('Shift+Enter');

      // Assert the no-data message is not visible
      await expect(page.locator('[data-testid="explore-no-data"]')).toBeHidden();

      // Click on the table toggle
      const tableButton = page.getByRole('radio', { name: 'Table' });
      await tableButton.click({ force: true });

      // One row with two cells initially
      const cells = page.locator('[role="cell"]');
      await expect(cells).toHaveCount(2);

      // Find and click on the targetLabelName label
      const targetLabelName = page.getByText('targetLabelName', { exact: true });
      await targetLabelName.scrollIntoViewIfNeeded();
      await expect(targetLabelName).toBeVisible();
      await targetLabelName.click();

      // Now we should have a row with 3 columns
      await expect(cells).toHaveCount(3);
      // And a value of "targetLabelValue"
      await expect(cells.getByText('targetLabelValue')).toBeVisible();

      // Click the Add button
      const addToButton = page.getByLabel('Add', { exact: true });
      await expect(addToButton).toBeVisible();
      await addToButton.click();

      // Click "Add to dashboard"
      const addToDashboardButton = page.getByLabel('Add to dashboard');
      await expect(addToDashboardButton).toBeVisible();
      await addToDashboardButton.click();

      // Click "Add panel to dashboard"
      const addPanelToDashboardButton = page.getByText('Add panel to dashboard');
      await expect(addPanelToDashboardButton).toBeVisible();

      // Click "Open dashboard"
      const openDashboardButton = page.getByText('Open dashboard');
      await expect(openDashboardButton).toBeVisible();
      await openDashboardButton.click();

      // Check the panel is visible
      const panel = page.locator('[data-viz-panel-key="panel-1"]');
      await expect(panel).toBeVisible();

      // Check the table cells in the panel
      const panelCells = panel.locator('[role="table"] [role="cell"]');
      // Should have 3 columns
      await expect(panelCells).toHaveCount(3);

      // Cells contain strings found in log line
      await expect(page.getByText('"wave":-0.5877852522916832')).toBeVisible();

      // Column has correct value of "targetLabelValue"
      await expect(panel.locator('[role="table"] [role="cell"]').filter({ hasText: 'targetLabelValue' })).toBeVisible();
    });
  }
);

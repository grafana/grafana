import { test, expect } from '@grafana/plugin-e2e';

const MISSING_LABEL_FILTER_ERROR_MESSAGE = 'Select at least 1 label filter (label and value)';
const dataSourceName = 'LokiBuilder';
const finalQuery = 'rate({instance=~"instance1|instance2"} | logfmt | __error__=`` [$__auto]';

test.describe(
  'Loki query builder',
  {
    tag: ['@various'],
  },
  () => {
    test('should be able to use all modes', async ({ createDataSource, page, dashboardPage, selectors }) => {
      await createDataSource({ type: 'loki', name: dataSourceName });
      // Mock API responses
      await page.route(/labels\?/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: ['instance', 'job', 'source'] }),
        });
      });

      await page.route(/series?/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: [{ instance: 'instance1' }] }),
        });
      });

      await page.route(/values/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: ['instance1', 'instance2'] }),
        });
      });

      await page.route(/index\/stats/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ streams: 2, chunks: 2660, bytes: 2721792, entries: 14408 }),
        });
      });

      // Go to Explore and choose Loki data source
      await page.goto('/explore');
      await dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container).click();
      await page.getByRole('button', { name: dataSourceName }).click();

      // Start in builder mode, click and choose query pattern
      await page.getByTestId(selectors.components.QueryBuilder.queryPatterns).click();
      await page.getByRole('button', { name: 'Log query starters' }).click();
      await page.getByRole('button', { name: 'Use this query' }).first().click();
      await expect(page.getByText('No pipeline errors')).toBeVisible();
      await expect(page.getByText('{} | logfmt | __error__=``')).toBeVisible();

      // Add operation
      await page.getByRole('button', { name: 'Operations', exact: true }).click();
      await page.getByText('Range functions').click();
      await page.getByText('Rate', { exact: true }).click();
      await expect(page.getByText('rate({} | logfmt | __error__=`` [$__auto]')).toBeVisible();

      // Check for expected error
      await expect(page.getByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeVisible();

      // Add labels to remove error
      await dashboardPage.getByGrafanaSelector(selectors.components.QueryBuilder.labelSelect).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.QueryBuilder.inputSelect).fill('instance');
      await page.keyboard.press('Enter');

      const matchOperatorSelect = dashboardPage.getByGrafanaSelector(
        selectors.components.QueryBuilder.matchOperatorSelect
      );
      await expect(matchOperatorSelect).toBeVisible();
      await matchOperatorSelect.click({ force: true });

      const matchOperatorInput = matchOperatorSelect.locator('div').locator('input');
      await matchOperatorInput.fill('=~');
      await page.keyboard.press('Enter');

      const valueSelect = dashboardPage.getByGrafanaSelector(selectors.components.QueryBuilder.valueSelect);
      await expect(valueSelect).toBeVisible();
      await valueSelect.click();

      const valueInput = valueSelect.locator('div').locator('input');
      await valueInput.fill('instance1');
      await page.keyboard.press('Enter');
      await valueInput.fill('instance2');
      await page.keyboard.press('Enter');

      await expect(page.getByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeHidden();
      await expect(page.getByText(finalQuery)).toBeVisible();

      // Change to code editor
      await page.getByRole('radio', { name: 'Code' }).click();

      // We need to test this manually because the final query is split into separate DOM elements
      await expect(page.getByText('rate')).toBeVisible();
      await expect(page.getByText('instance1|instance2')).toBeVisible();
      await expect(page.getByText('logfmt')).toBeVisible();
      await expect(page.getByText('__error__')).toBeVisible();
      await expect(page.getByText('$__auto')).toBeVisible();

      // Checks the explain mode toggle
      await page.getByText('Explain').click();
      await expect(page.getByText('Fetch all log lines matching label filters.')).toBeVisible();
    });
  }
);

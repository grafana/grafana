import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'adhjhtt';

test.use({ viewport: { width: 2000, height: 1080 } });
test.describe('Panels test: LogsTable - Kitchen Sink', { tag: ['@panels', '@logstable'] }, () => {
  test('should render logs table panel', async ({ page, gotoDashboardPage, selectors }) => {
    // this test can absolutely take longer than the default 30s timeout
    test.setTimeout(120_000);

    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
    ).toBeVisible();

    // View log line button should be defined by default
    await expect(page.getByLabel('View log line').first()).toBeVisible();

    // timestamp and log body headers should be visible
    await expect(page.getByRole('columnheader', { name: 'timestamp' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'body' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'bytes' })).toHaveCount(0);

    // timestamp and body columns are selected
    await expect(page.getByRole('checkbox', { name: 'timestamp' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'body' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'bytes' })).toBeVisible();

    // bytes field is not selected
    await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked();

    // Select bytes field
    await page.getByText('bytes', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'bytes' })).toBeChecked();
    await expect(page.getByRole('columnheader', { name: 'bytes' })).toBeVisible();

    // Reset
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('columnheader', { name: 'bytes' })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked();

    // Search input is visible
    await expect(page.getByRole('textbox', { name: 'Search fields by name' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Search fields by name' }).fill('btyes'); // Fuzzy search matches "bytes" against "btyes" (Levenshtein distance < 2)
    await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked();

    await expect(page.getByRole('columnheader', { name: 'bytes' })).toHaveCount(0);
    await page.getByText('bytes', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'bytes' })).toBeChecked();
    await expect(page.getByRole('columnheader', { name: 'bytes' })).toBeVisible();

    // Clear search input
    await page.getByRole('button', { name: 'Clear' }).click();

    // Reset
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('columnheader', { name: 'bytes' })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked();

    // Selected fields collapse
    await expect(page.getByText('Selected fields')).toBeVisible();
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByText('Selected fields')).not.toBeVisible();
  });

  test.skip('Options: Show inspect button', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
    ).toBeVisible();
  });

  test.skip('Options: Copy log line button', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
    ).toBeVisible();
  });

  test.skip('Options: Show controls', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
    ).toBeVisible();
  });

  test.skip('No data', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
    ).toBeVisible();
  });
});

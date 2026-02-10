import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'adhjhtt';

test.use({ viewport: { width: 2000, height: 1080 } });
test.describe('Panels test: LogsTable', { tag: ['@panels', '@logstable'] }, () => {
  test.describe('Defaults', () => {
    test('Should render logs table panel', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '2' }),
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
      await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked({ timeout: 400 });

      // Select bytes field
      await page.getByText('bytes', { exact: true }).click();
      await expect(page.getByRole('checkbox', { name: 'bytes' })).toBeChecked();
      await expect(page.getByRole('columnheader', { name: 'bytes' })).toBeVisible();

      // Reset
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page.getByRole('columnheader', { name: 'bytes' })).toHaveCount(0);
      await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked({ timeout: 400 });

      // Search input is visible
      await expect(page.getByRole('textbox', { name: 'Search fields by name' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Search fields by name' }).fill('btyes'); // Fuzzy search matches "bytes" against "btyes" (Levenshtein distance < 2)
      await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked({ timeout: 400 });

      await expect(page.getByRole('columnheader', { name: 'bytes' })).toHaveCount(0);
      await page.getByText('bytes', { exact: true }).click();
      await expect(page.getByRole('checkbox', { name: 'bytes' })).toBeChecked();
      await expect(page.getByRole('columnheader', { name: 'bytes' })).toBeVisible();

      // Clear search input
      await page.getByRole('button', { name: 'Clear' }).click();

      // Reset
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page.getByRole('columnheader', { name: 'bytes' })).toHaveCount(0);
      await expect(page.getByRole('checkbox', { name: 'bytes' })).not.toBeChecked({ timeout: 400 });

      // Selected fields collapse
      await expect(page.getByText('Selected fields')).toBeVisible();
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(page.getByText('Selected fields')).not.toBeVisible();
    });
    test('Show inspect button', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '2' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
      ).toBeVisible();

      await expect(page.getByRole('columnheader', { name: 'timestamp' })).toBeVisible();
      await page.getByRole('columnheader', { name: 'timestamp' }).click();

      // Hide body
      // @todo locator.click does not work to deselect checkboxes, just causes infinite click loop without updating state, when clicking on the label or the checkbox. Is there a less hacky way to deselect?
      await expect.poll(() => page.getByRole('checkbox', { name: 'body' }).isChecked()).toEqual(true);
      page.getByLabel(/body/).first().dispatchEvent('click');
      await expect.poll(() => page.getByRole('checkbox', { name: 'body' }).isChecked()).toEqual(false);

      // Click inspect on 9th row
      await page.getByRole('gridcell').getByLabel('View log line').nth(9).click();

      // Assert drawer header is visible
      await expect(page.getByRole('heading', { name: 'Inspect value' })).toBeVisible();

      // Assert the inspect drawer shows the correct log line body
      await expect(page.getByLabel('Drawer title Inspect value').locator('.view-lines')).toContainText(
        `level=info ts=2026-02-06T18:42:42.083508023Z caller=flush.go:253 msg="completing block" userid=29 blockID=73zco`
      );
    });
  });
  test.describe('Options', () => {
    test('Inspect button', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '2' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
      ).toBeVisible();

      const optionWrapper = page.getByLabel('Logs Table Show inspect button field property editor');
      const option = optionWrapper.getByLabel(/Show inspect button/);
      const inspectLogLineButton = page.getByLabel('View log line');
      await expect(option).toHaveCount(1);
      await expect(option).toBeChecked();
      await expect(inspectLogLineButton.nth(0)).toBeVisible();
      await optionWrapper.click();
      await expect(option).not.toBeChecked({ timeout: 400 });
      await expect(inspectLogLineButton).toHaveCount(0);
    });
    test('Copy log line button', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '2' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
      ).toBeVisible();

      const optionWrapper = page.getByLabel('Logs Table Show copy log link button field property editor');
      const option = optionWrapper.getByLabel(/Show copy log link button/);
      const copyLogLineButton = page.getByLabel('Copy link to log line');

      await expect(option).toHaveCount(1);
      await expect(option).not.toBeChecked({ timeout: 400 });
      await expect(copyLogLineButton).toHaveCount(0);
      await optionWrapper.click();
      await expect(option).toBeChecked();
      await expect(copyLogLineButton.nth(0)).toBeVisible();
    });
    test('Show controls', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '2' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
      ).toBeVisible();

      const optionWrapper = page.getByLabel('Logs Table Show controls field property editor');
      const optionLabel = optionWrapper.getByText(/Show controls/);
      const option = optionWrapper.getByLabel(/Show controls/);
      const controlsExpandButtonDefault = page.getByLabel('Collapse', { exact: true });
      const controlsExpandButtonChecked = page.getByLabel('Expand', { exact: true });
      const controlsSortByButtonNewest = page.getByLabel('Sorted by newest logs first - Click to show oldest first', {
        exact: true,
      });
      const controlsSortByButtonOldest = page.getByLabel('Sorted by oldest logs first - Click to show newest first', {
        exact: true,
      });

      // Assert default option state
      await expect(option).toHaveCount(1);
      await expect(option).not.toBeChecked({ timeout: 400 });
      await expect(controlsExpandButtonDefault).toHaveCount(0);
      await expect(controlsSortByButtonNewest).toHaveCount(0);

      // Toggle option on
      await optionLabel.click();
      await expect(option).toBeChecked();
      await expect(controlsExpandButtonDefault).toHaveCount(1);
      await expect(controlsSortByButtonNewest).toHaveCount(1);

      // Sort by should update state (but won't change logs in test data source)
      await controlsSortByButtonNewest.click();
      await expect(controlsSortByButtonOldest).toHaveCount(1);

      // Collapse expanded options sidebar
      await controlsExpandButtonDefault.click();
      await expect(controlsExpandButtonChecked).toHaveCount(1);
    });
  });
  test.describe('No data', () => {
    test('Invalid logs frame', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '3' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Not logs panel'))
      ).toBeVisible();

      await expect(page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage)).toBeVisible();
      await expect(page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage)).toContainText(
        'Data is missing a string field'
      );
    });
    test('Empty logs frame', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '4' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('No data panel'))
      ).toBeVisible();

      await expect(page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage)).toBeVisible();
      await expect(page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage)).toContainText('No data');
    });
  });
});

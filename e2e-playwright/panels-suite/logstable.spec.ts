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
      await expect(page.getByLabel('View log line').first(), 'View log line button defined by default').toBeVisible();

      // timestamp and log body headers should be visible
      await expect(
        page.getByRole('columnheader', { name: 'timestamp' }),
        'table timestamp column is visible'
      ).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'body' }), 'Table "body" column is visible').toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: 'bytes' }),
        'Table "timestamp" column is not present'
      ).toHaveCount(0);

      // timestamp and body columns are selected
      await expect(
        page.getByRole('checkbox', { name: 'timestamp' }),
        'Field selector "timestamp" field is checked'
      ).toBeChecked();
      await expect(
        page.getByRole('checkbox', { name: 'body' }),
        'Field selector "body" field is checked'
      ).toBeChecked();
      await expect(
        page.getByRole('checkbox', { name: 'bytes' }),
        'Field selector "bytes" field is visible'
      ).toBeVisible();

      // bytes field is not selected
      await expect(
        page.getByRole('checkbox', { name: 'bytes' }),
        'Field selector "bytes" field is not checked'
      ).not.toBeChecked({ timeout: 400 });

      // Select bytes field
      await page.getByText('bytes', { exact: true }).click();
      await expect(
        page.getByRole('checkbox', { name: 'bytes' }),
        'Field selector "bytes" field is checked'
      ).toBeChecked();
      await expect(page.getByRole('columnheader', { name: 'bytes' }), 'Table "bytes" column is visible').toBeVisible();

      // Reset
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(
        page.getByRole('columnheader', { name: 'bytes' }),
        'Table "bytes" column is no longer visible after reset'
      ).toHaveCount(0);
      await expect(
        page.getByRole('checkbox', { name: 'bytes' }),
        'Field selector "bytes" field is not checked after reset'
      ).not.toBeChecked({ timeout: 400 });

      // Search input is visible
      await expect(
        page.getByRole('textbox', { name: 'Search fields by name' }),
        'Field selector search input is visible'
      ).toBeVisible();
      await page.getByRole('textbox', { name: 'Search fields by name' }).fill('btyes'); // Fuzzy search matches "bytes" against "btyes" (Levenshtein distance < 2)
      await expect(
        page.getByRole('checkbox', { name: 'bytes' }),
        'Field selector "bytes" field is not checked'
      ).not.toBeChecked({ timeout: 400 });

      await expect(
        page.getByRole('columnheader', { name: 'bytes' }),
        'Table "bytes" field is not in the table'
      ).toHaveCount(0);
      await page.getByText('bytes', { exact: true }).click();
      await expect(
        page.getByRole('checkbox', { name: 'bytes' }),
        'Field selector "bytes" field is checked'
      ).toBeChecked();
      await expect(
        page.getByRole('columnheader', { name: 'bytes' }),
        'Table "bytes" field is in the table'
      ).toBeVisible();

      // Clear search input
      await page.getByRole('button', { name: 'Clear' }).click();

      // Reset
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(
        page.getByRole('columnheader', { name: 'bytes' }),
        'Table "bytes" field is not in the table'
      ).toHaveCount(0);
      await expect(
        page.getByRole('checkbox', { name: 'bytes' }),
        'Field selector "bytes" field is checked'
      ).not.toBeChecked({ timeout: 400 });

      // Selected fields collapse
      await expect(page.getByText('Selected fields'), 'Field selector title is visible').toBeVisible();
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(page.getByText('Selected fields'), 'Field selector title is no longer visible').not.toBeVisible();
    });
    test('Show inspect button', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '2' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
      ).toBeVisible();

      await expect(
        page.getByRole('columnheader', { name: 'timestamp' }),
        'table timestamp column is visible'
      ).toBeVisible();
      await page.getByRole('columnheader', { name: 'timestamp' }).click();

      // Hide body
      // @todo locator.click does not work to deselect these draggable checkboxes, just causes infinite click loop without updating state, when clicking on the label or the checkbox. Is there a less hacky way to deselect?
      await expect
        .poll(() => page.getByRole('checkbox', { name: 'body' }).isChecked(), 'Field selector body field is checked')
        .toEqual(true);
      page.getByLabel(/body/).first().dispatchEvent('click');
      await expect
        .poll(
          () => page.getByRole('checkbox', { name: 'body' }).isChecked(),
          'Field selector body field is no longer checked'
        )
        .toEqual(false);

      // Click inspect on 9th row
      await page.getByRole('gridcell').getByLabel('View log line').nth(9).click();

      // Assert drawer header is visible
      await expect(
        page.getByRole('heading', { name: 'Inspect value' }),
        'Inspect drawer title is visible'
      ).toBeVisible();

      // Assert the inspect drawer shows the correct log line body
      await expect(
        page.getByRole('dialog', { name: 'Inspect value' }).locator('.view-lines'),
        'Drawer contains correct log line'
      ).toContainText(
        `level=info ts=2026-02-06T18:42:46.211051027Z caller=poller.go:133 msg="blocklist poll complete" seconds=526`
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
      await expect(option, 'Inspect button panel option is in the document').toHaveCount(1);
      await expect(option, 'Inspect button panel option is initially checked').toBeChecked();
      await expect(inspectLogLineButton.nth(0), 'Inspect button is visible in the logs table viz').toBeVisible();
      await optionWrapper.click();
      await expect(option, 'Inspect button panel option is no longer checked').not.toBeChecked({ timeout: 400 });
      await expect(inspectLogLineButton, 'Inspect button is no longer in the logs table viz').toHaveCount(0);
    });
    test('Copy log line button', async ({ page, gotoDashboardPage, selectors, context }) => {
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

      await expect(option, 'Show log line panel option is in the document').toHaveCount(1);
      await expect(option, 'Show log line panel option is not checked').not.toBeChecked({ timeout: 400 });
      await expect(copyLogLineButton, 'Show log line button is not in the table viz').toHaveCount(0);
      await optionWrapper.click();
      await expect(option, 'Show log line panel option is now checked').toBeChecked();
      await expect(copyLogLineButton.nth(0), 'Show log line button is visible in the table viz').toBeVisible();
      await copyLogLineButton.nth(9).click();

      // Copy to clipboard doesn't work in CI since it is run in an unsecure context that isn't on localhost, hardcoding the panel state for now instead of removing the test.
      await page.goto(
        '/d/adhjhtt/logstable-kitchen-sink?orgId=1&panelState=%7B"logs":%7B"id":"1770403366020954082_3665f3ae"%7D%7D&editPanel=2'
      );

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
      ).toBeVisible();

      const selectedRow = page.locator('[role="row"][aria-selected="true"]');
      await expect(selectedRow, 'Row is selected').toBeVisible();
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
      await expect(option, 'Show controls panel option is in the document').toHaveCount(1);
      await expect(option, 'Show controls panel option is not checked by default').not.toBeChecked({ timeout: 400 });
      await expect(controlsExpandButtonDefault, 'Logs control collapse button is not in the controls').toHaveCount(0);
      await expect(controlsSortByButtonNewest, 'Logs controls sort order button is not in controls').toHaveCount(0);

      // Toggle option on
      await optionLabel.click();
      await expect(option, 'Show controls panel option is now checked').toBeChecked();
      await expect(controlsExpandButtonDefault, 'Logs control collapse button is now in the controls').toHaveCount(1);
      await expect(controlsSortByButtonNewest, 'Logs control sort order button is now in the controls').toHaveCount(1);

      // Sort by should update state (but won't change logs in test data source)
      await controlsSortByButtonNewest.click();
      await expect(controlsSortByButtonOldest, 'Logs control sort order button state is toggled').toHaveCount(1);

      // Collapse expanded options sidebar
      await controlsExpandButtonDefault.click();
      await expect(controlsExpandButtonChecked, 'Logs control state is now collapsed').toHaveCount(1);
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

      await expect(
        page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage),
        'Panel error message is visible'
      ).toBeVisible();
      await expect(
        page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage),
        'Panel error message is "missing a string field"'
      ).toContainText('Data is missing a string field');
    });
    test('Empty logs frame', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '4' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('No data panel'))
      ).toBeVisible();

      await expect(
        page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage),
        'Panel error message is visible'
      ).toBeVisible();
      await expect(
        page.getByTestId(selectors.components.Panels.Panel.PanelDataErrorMessage),
        'Panel error message is "no data"'
      ).toContainText('No data');
    });
  });
});

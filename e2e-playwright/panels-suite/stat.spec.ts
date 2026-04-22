import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'EJ8_d9jZk';

test.use({
  viewport: { width: 1280, height: 4000 },
});

test.describe('Panels test: Stat', { tag: ['@panels', '@stat'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Horizontal with graph')),
      'stat panel is rendered'
    ).toBeVisible();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('"no data"', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '33' }),
    });

    const emptyMessage = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage);
    await expect(emptyMessage, 'that the empty text appears').toHaveText('No data');

    const noValueOption = dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Standard options No value'))
      .locator('input');

    await noValueOption.fill('My empty value');
    await noValueOption.blur();
    await expect(emptyMessage, 'that the empty text has changed').toHaveText('My empty value');
  });

  test('sparkline: area mode renders a chart per series', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '6' }),
    });

    // panel 6 has 6 series with graphMode: area — each BigValue renders a uplot sparkline
    await expect(page.locator('.uplot'), 'area sparkline renders for each of 6 series').toHaveCount(6);
  });

  test('sparkline: line mode renders a chart per series', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '8' }),
    });

    // panel 8 has 7 series with graphMode: line — each BigValue renders a uplot sparkline
    await expect(page.locator('.uplot'), 'line sparkline renders for each of 7 series').toHaveCount(7);
  });

  test('sparkline: no chart when graphMode is none', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '15' }),
    });

    await expect(page.locator('.uplot'), 'no sparkline chart when graphMode is none').toBeHidden();
  });

  test('text mode: name displays series names', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '15' }),
    });

    // panel 15 uses textMode: name with __server_names alias — predictable names from testdata
    await expect(page.getByText('Backend-ops-01'), 'first server name is shown as BigValue title').toBeVisible();
  });

  test('text mode: value with 45 series renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '16' }),
    });

    // panel 16 uses textMode: value with 45 series (values only, no series name titles)
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors with textMode: value and 45 series').toBeHidden();
  });

  test('text mode: none with 200 series renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '17' }),
    });

    // panel 17 uses textMode: none with 200 series (colored cells, no visible text)
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors with textMode: none and 200 series').toBeHidden();
  });

  test('color mode: background renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '6' }),
    });

    // panel 6 uses colorMode: background — threshold colors fill the cell backgrounds
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors with colorMode: background').toBeHidden();
  });

  test('color mode: value renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '14' }),
    });

    // panel 14 uses colorMode: value — threshold colors applied to text only
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors with colorMode: value').toBeHidden();
  });

  test('percent change: positive value shows upward arrow', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '29' }),
    });

    // panel 29: fixed CSV data 0 → 100 (Infinity percent change) — deterministic arrow-up icon
    await expect(page.getByTestId('icon-arrow-up'), 'upward arrow is shown for positive percent change').toBeVisible();
  });

  test('percent change: zero shows no directional arrow', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '32' }),
    });

    // panel 32: fixed CSV data 50 → 100 → 50 (0% net change) — shows "0%" text but no arrow
    await expect(page.getByTestId('icon-arrow-up'), 'no upward arrow for zero percent change').toBeHidden();
    await expect(page.getByTestId('icon-arrow-down'), 'no downward arrow for zero percent change').toBeHidden();
  });

  test('percent change: NaN is not displayed', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '30' }),
    });

    // panel 30: fixed CSV data 0 → 0 (0/0 = NaN percent change) — percent change widget is hidden
    await expect(page.getByTestId('icon-arrow-up'), 'no upward arrow for NaN percent change').toBeHidden();
    await expect(page.getByTestId('icon-arrow-down'), 'no downward arrow for NaN percent change').toBeHidden();
  });
});

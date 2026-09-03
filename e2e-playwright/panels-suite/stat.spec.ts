import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'EJ8_d9jZk';

test.use({
  viewport: { width: 1280, height: 4000 },
});

test.describe('Panels test: Stat', { tag: ['@panels', '@stat'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-31' }),
    });
    const panel = dashboardPage.getPanelById('31');

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Value Options All')),
      'stat panel is rendered'
    ).toBeVisible();

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator }),
      'panel has content'
    ).not.toBeEmpty();
    await expect(panel.getErrorIcon(), 'no errors in the panel').toBeHidden();
  });

  test('"no data"', async ({ gotoDashboardPage, selectors }) => {
    // stays in edit mode — this test changes the "No value" standard option
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '33' }),
    });
    const panel = dashboardPage.getPanelById('33');
    await expect(panel.locator, 'stat panel is rendered').toBeVisible();

    const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, {
      root: panel.locator,
    });
    await expect(panelContent, 'that the empty text appears').toHaveText('No data');

    const noValueOption = dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Standard options No value'))
      .locator('input');

    await noValueOption.fill('My empty value');
    await noValueOption.blur();
    await expect(panelContent, 'that the empty text has changed').toHaveText('My empty value');
  });

  test('sparkline: area mode renders a chart per series', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-6' }),
    });
    const panel = dashboardPage.getPanelById('6');

    // panel 6 has 6 series with graphMode: area — each BigValue renders a uplot sparkline
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator })
        .locator('.uplot'),
      'area sparkline renders for each of 6 series'
    ).toHaveCount(6);
  });

  test('sparkline: line mode renders a chart per series', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-8' }),
    });
    const panel = dashboardPage.getPanelById('8');

    // panel 8 has 7 series with graphMode: line — each BigValue renders a uplot sparkline
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator })
        .locator('.uplot'),
      'line sparkline renders for each of 7 series'
    ).toHaveCount(7);
  });

  test('sparkline: no chart when graphMode is none', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-15' }),
    });
    const panel = dashboardPage.getPanelById('15');

    const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, {
      root: panel.locator,
    });
    // non-empty content first: toBeHidden() would pass on a panel that has not drawn yet
    await expect(panelContent, 'panel has content').not.toBeEmpty();

    await expect(panelContent.locator('.uplot'), 'no sparkline chart when graphMode is none').toBeHidden();
  });

  test('text mode: name displays series names', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-15' }),
    });
    const panel = dashboardPage.getPanelById('15');

    // panel 15 uses textMode: name with __server_names alias — predictable names from testdata
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator })
        .getByText('Backend-ops-01'),
      'first server name is shown as BigValue title'
    ).toBeVisible();
  });

  test('text mode: value with 45 series renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-16' }),
    });
    const panel = dashboardPage.getPanelById('16');

    await expect(panel.locator, 'stat panel is rendered').toBeVisible();

    // panel 16 uses textMode: value with 45 series — random_walk values vary but the areaM2 unit
    // suffix does not, so it proves values rendered and rules out "No data" in one check
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator }),
      'series values are rendered'
    ).toContainText('m²');

    await expect(panel.getErrorIcon(), 'no errors with textMode: value and 45 series').toBeHidden();
  });

  test('text mode: none with 200 series renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-17' }),
    });
    const panel = dashboardPage.getPanelById('17');

    // panel 17 uses textMode: none with 200 series — colored cells, no text to assert on
    await expect(panel.locator, 'stat panel is rendered').toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator }),
      'panel does not have "no data"'
    ).not.toHaveText('No data');
    await expect(panel.getErrorIcon(), 'no errors with textMode: none and 200 series').toBeHidden();
  });

  test('color mode: background renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-6' }),
    });
    const panel = dashboardPage.getPanelById('6');

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator }),
      'panel has content'
    ).not.toBeEmpty();

    // panel 6 uses colorMode: background — threshold colors fill the cell backgrounds
    await expect(panel.getErrorIcon(), 'no errors with colorMode: background').toBeHidden();
  });

  test('color mode: value renders without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-14' }),
    });
    const panel = dashboardPage.getPanelById('14');

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator }),
      'panel has content'
    ).not.toBeEmpty();

    // panel 14 uses colorMode: value — threshold colors applied to text only
    await expect(panel.getErrorIcon(), 'no errors with colorMode: value').toBeHidden();
  });

  test('percent change: positive value shows upward arrow', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-29' }),
    });
    const panel = dashboardPage.getPanelById('29');

    // panel 29: fixed CSV data 0 → 100 (Infinity percent change) — deterministic arrow-up icon
    await expect(
      panel.locator.getByTestId('icon-arrow-up'),
      'upward arrow is shown for positive percent change'
    ).toBeVisible();
  });

  test('percent change: zero shows no directional arrow', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-32' }),
    });
    const panel = dashboardPage.getPanelById('32');

    // panel 32: fixed CSV data 50 → 100 → 50 (0% net change) — shows "0%" text but no arrow
    // wait for the percent-change widget to render before asserting arrow absence, otherwise
    // toBeHidden() passes instantly on not-yet-attached icons (false positive).
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator }),
      'percent change widget rendered'
    ).toContainText('0%');

    await expect(panel.locator.getByTestId('icon-arrow-up'), 'no upward arrow for zero percent change').toBeHidden();
    await expect(
      panel.locator.getByTestId('icon-arrow-down'),
      'no downward arrow for zero percent change'
    ).toBeHidden();
  });

  test('percent change: NaN is not displayed', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-30' }),
    });
    const panel = dashboardPage.getPanelById('30');

    // panel 30: fixed CSV data 0 → 0 (0/0 = NaN percent change) — percent change widget is hidden
    // wait for the stat value to render before asserting arrow absence, otherwise toBeHidden()
    // passes instantly on not-yet-attached icons (false positive).
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, { root: panel.locator }),
      'stat value rendered'
    ).toContainText('0');

    await expect(panel.locator.getByTestId('icon-arrow-up'), 'no upward arrow for NaN percent change').toBeHidden();
    await expect(panel.locator.getByTestId('icon-arrow-down'), 'no downward arrow for NaN percent change').toBeHidden();
  });

  test('data link: single link wraps each stat cell as anchor', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-31' }),
    });
    const panel = dashboardPage.getPanelById('31');

    // panel 31 "Value Options All" has 2 static values (Name1=10, Name2=20) and a single data link
    // each BigValue cell is wrapped in an <a> pointing to the configured URL
    const dataLinks = dashboardPage.getByGrafanaSelector(selectors.components.DataLinksContextMenu.singleLink, {
      root: panel.locator,
    });
    await expect(dataLinks.first(), 'stat cell with data link is rendered as anchor').toBeVisible();
    await expect(dataLinks, 'both stat cells have the data link').toHaveCount(2);
    await expect(dataLinks.first(), 'data link href matches configured URL').toHaveAttribute(
      'href',
      '/d/EJ8_d9jZk?q=10'
    );
  });
});

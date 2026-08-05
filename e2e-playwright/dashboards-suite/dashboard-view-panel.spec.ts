import { test, expect, type DashboardPage, type DashboardPageArgs, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { importTestDashboard } from '../dashboard-new-layouts/utils';

const DASHBOARD_UID = 'gdev-view-panel-tests';

// Separate user to isolate changes from other tests
test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: {
    flags: {
      'grafana.viewPanelPane': true,
    },
  },
});

test.describe('View panel', { tag: ['@dashboards'] }, () => {
  test('Can enter and exit view panel', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await openTestDashboardAndEnterViewPanel(gotoDashboardPage, selectors);

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.headerTitle)).toContainText(
      'View panel'
    );

    await dashboardPage.getByGrafanaSelector(selectors.components.ViewPanelSidePane.goBackButton).click();
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.headerTitle)).not.toBeVisible();
  });

  test('Can toggle panel viz option', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await openTestDashboardAndEnterViewPanel(gotoDashboardPage, selectors);

    const legend = dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.legend);

    await page.locator(`label[for='legend.showLegend']`).first().click();
    await expect(legend).toBeVisible();

    await page.locator(`label[for='legend.showLegend']`).first().click();
    await expect(legend).toBeHidden();
  });

  test('Can fan-out by series', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await openTestDashboardAndEnterViewPanel(gotoDashboardPage, selectors);

    await page.locator(`input[id='$__by_series__$']`).click();

    const headers = await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
      .locator('h2')
      .all();

    const headerTitles = await Promise.all(headers.map((header) => header.innerText()));

    expect(headerTitles).toEqual([
      'A-series {method="GET", status="200"}',
      'C-series {method="GET", status="302"}',
      'D-series {method="POST", status="200"}',
      'E-series {method="POST", status="403"}',
      'F-series {method="POST", status="503"}',
      'B-series {method="POST", status="502"}',
    ]);
  });

  test('Can fan-out by label', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await openTestDashboardAndEnterViewPanel(gotoDashboardPage, selectors);

    await page.locator(`input[id='$__by_label__method']`).click();

    const headers = await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
      .locator('h2')
      .all();

    const headerTitles = await Promise.all(headers.map((header) => header.innerText()));

    expect(headerTitles).toEqual(['method=GET', 'method=POST']);

    // Verify url is updated
    await expect(page).toHaveURL((url) => {
      const params = url.searchParams;
      return params.get('fanout') === '$__by_label__method';
    });
  });

  test('Can fan-out by label based on url sync', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-1', fanout: '$__by_label__method' }),
    });

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.headerTitle)).toContainText(
      'View panel'
    );

    await page.waitForTimeout(1000);

    const headers = await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
      .locator('h2')
      .all();

    const headerTitles = await Promise.all(headers.map((header) => header.innerText()));

    expect(headerTitles).toEqual(['method=GET', 'method=POST']);

    // Go back to dashboard
    await dashboardPage.getByGrafanaSelector(selectors.components.ViewPanelSidePane.goBackButton).click();

    // Verify fanout param is removed
    await expect(page).toHaveURL((url) => url.searchParams.has('fanout') === false);
  });
});

async function openTestDashboardAndEnterViewPanel(
  gotoDashboardPage: (args: DashboardPageArgs) => Promise<DashboardPage>,
  selectors: E2ESelectorGroups
) {
  const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

  const timeSeriesPanelTitle = 'Time series panel';
  const panelTitle = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(timeSeriesPanelTitle));
  await panelTitle.hover();
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(timeSeriesPanelTitle)).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('View')).click();

  return dashboardPage;
}

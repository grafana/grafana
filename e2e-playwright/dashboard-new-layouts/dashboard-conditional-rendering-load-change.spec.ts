import { Page } from '@playwright/test';

import { test, expect, E2ESelectorGroups, DashboardPage, DashboardPageArgs } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/DashboardWithAllConditionalRendering.json';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe('Dashboard - Conditional Rendering - Load and Change', { tag: ['@dashboards'] }, () => {
  let uid: string;

  const loadDashboard = async (
    page: Page,
    gotoDashboardPage: (args: DashboardPageArgs) => Promise<DashboardPage>,
    options?: { from?: string; to?: string; myVariable?: string }
  ) => {
    const params: DashboardPageArgs = { uid };

    if (options?.from && options?.to) {
      params.timeRange = {
        from: options.from,
        to: options.to,
      };
    }

    if (options?.myVariable) {
      params.queryParams = new URLSearchParams();
      params.queryParams.set('var-myVariable', options.myVariable);
    }

    const dashboardPage = await gotoDashboardPage(params);
    await expect(page.getByText(testDashboard.spec.title)).toBeVisible();
    await page.waitForLoadState('networkidle');
    return dashboardPage;
  };

  const fillVariable = async (page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups, text: string) => {
    const variable = dashboardPage
      .getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(testDashboard.spec.variables[0].spec.name)
      )
      .locator('..')
      .locator('input');
    await variable.click();
    await variable.clear();
    await variable.fill(text);
    await variable.press('Enter');
    await page.waitForLoadState('networkidle');
  };

  const setTimeRange = async (
    page: Page,
    dashboardPage: DashboardPage,
    selectors: E2ESelectorGroups,
    from: string,
    to: string
  ) => {
    await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();
    const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
    await fromField.click();
    await fromField.fill(from);
    const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);
    await toField.click();
    await toField.fill(to);
    await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.applyTimeRange).click();
    await page.waitForLoadState('networkidle');
  };

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/apis/dashboard.grafana.app/v2beta1/namespaces/stacks-12345/dashboards', {
      data: {
        metadata: {
          annotations: {
            'grafana.app/folder': '',
            'grafana.app/grant-permissions': 'default',
          },
          generateName: 'ad',
        },
        spec: testDashboard.spec,
      },
    });
    const responseBody = await response.json();
    uid = responseBody.metadata.name;
  });

  test.afterAll(async ({ request }) => {
    if (uid) {
      await request.delete(`/apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/${uid}`);
    }
  });

  const getPanel = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, title: string) =>
    dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(`Panel - ${title}`));

  const getPanelShowData = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'show - data');

  const getPanelHideData = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'hide - data');

  const getPanelShowNoData = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'show - no data');

  const getPanelHideNoData = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'hide - no data');

  const getPanelShowTimeRange = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'show - time range <7d');

  const getPanelHideTimeRange = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'hide - time range <7d');

  const getPanelShowEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'show - variable - equals 1,2,3');

  const getPanelHideEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'hide - variable - equals 1,2,3');

  const getPanelShowNotEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'show - variable - not equals 1,2,3');

  const getPanelHideNotEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'hide - variable - not equals 1,2,3');

  const getPanelShowMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'show - variable - matches .*2.*');

  const getPanelHideMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'hide - variable - matches .*2.*');

  const getPanelShowNotMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'show - variable - not matches .*2.*');

  const getPanelHideNotMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getPanel(dashboardPage, selectors, 'hide - variable - not matches .*2.*');

  const getRow = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, title: string) =>
    dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`Row - ${title}`));

  const getRowShowTimeRange = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'show - time range <7d');

  const getRowHideTimeRange = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'hide - time range <7d');

  const getRowShowEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'show - variable - equals 1,2,3');

  const getRowHideEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'hide - variable - equals 1,2,3');

  const getRowShowNotEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'show - variable - not equals 1,2,3');

  const getRowHideNotEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'hide - variable - not equals 1,2,3');

  const getRowShowMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'show - variable - matches .*2.*');

  const getRowHideMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'hide - variable - matches .*2.*');

  const getRowShowNotMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'show - variable - not matches .*2.*');

  const getRowHideNotMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getRow(dashboardPage, selectors, 'hide - variable - not matches .*2.*');

  const getTab = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, title: string) =>
    dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`Tab - ${title}`));

  const getTabShowTimeRange = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'show - time range <7d');

  const getTabHideTimeRange = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'hide - time range <7d');

  const getTabShowEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'show - variable - equals 1,2,3');

  const getTabHideEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'hide - variable - equals 1,2,3');

  const getTabShowNotEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'show - variable - not equals 1,2,3');

  const getTabHideNotEquals = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'hide - variable - not equals 1,2,3');

  const getTabShowMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'show - variable - matches .*2.*');

  const getTabHideMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'hide - variable - matches .*2.*');

  const getTabShowNotMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'show - variable - not matches .*2.*');

  const getTabHideNotMatches = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
    getTab(dashboardPage, selectors, 'hide - variable - not matches .*2.*');

  test('Load without data', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage);

    await expect(getPanelShowData(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideData(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelShowNoData(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideNoData(dashboardPage, selectors)).not.toBeVisible();

    await fillVariable(page, dashboardPage, selectors, '1,2,3,4');

    await expect(getPanelShowData(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideData(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelShowNoData(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideNoData(dashboardPage, selectors)).toBeVisible();
  });

  test('Load with data', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage, { myVariable: '1,2,3,4' });

    await expect(getPanelShowData(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideData(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelShowNoData(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideNoData(dashboardPage, selectors)).toBeVisible();

    await fillVariable(page, dashboardPage, selectors, '');

    await expect(getPanelShowData(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideData(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelShowNoData(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideNoData(dashboardPage, selectors)).not.toBeVisible();
  });

  test('Load without time range', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage);

    await expect(getPanelShowTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideTimeRange(dashboardPage, selectors)).not.toBeVisible();

    await setTimeRange(page, dashboardPage, selectors, 'now-8d', 'now');

    await expect(getPanelShowTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideTimeRange(dashboardPage, selectors)).toBeVisible();
  });

  test('Load with time range', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage, { from: 'now-8d', to: 'now' });

    await expect(getPanelShowTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideTimeRange(dashboardPage, selectors)).toBeVisible();

    await setTimeRange(page, dashboardPage, selectors, 'now-6h', 'now');

    await expect(getPanelShowTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideTimeRange(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowTimeRange(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideTimeRange(dashboardPage, selectors)).not.toBeVisible();
  });

  test('Load without variable equals/not equals', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage);

    await expect(getPanelShowEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelShowNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideNotEquals(dashboardPage, selectors)).not.toBeVisible();

    await fillVariable(page, dashboardPage, selectors, '1,2,3');

    await expect(getPanelShowEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelShowNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideNotEquals(dashboardPage, selectors)).toBeVisible();
  });

  test('Load with variable equals/not equals', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage, { myVariable: '1,2,3' });

    await expect(getPanelShowEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelShowNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideNotEquals(dashboardPage, selectors)).toBeVisible();

    await fillVariable(page, dashboardPage, selectors, '');

    await expect(getPanelShowEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelShowNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideNotEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowEquals(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowNotEquals(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideNotEquals(dashboardPage, selectors)).not.toBeVisible();
  });

  test('Load without variable matches/not matches', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage);

    await expect(getPanelShowMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelShowNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideNotMatches(dashboardPage, selectors)).not.toBeVisible();

    await fillVariable(page, dashboardPage, selectors, '1,2,3');

    await expect(getPanelShowMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelShowNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideNotMatches(dashboardPage, selectors)).toBeVisible();
  });

  test('Load with variable matches/not matches', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await loadDashboard(page, gotoDashboardPage, { myVariable: '1,2,3' });

    await expect(getPanelShowMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelShowNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideNotMatches(dashboardPage, selectors)).toBeVisible();

    await fillVariable(page, dashboardPage, selectors, '');

    await expect(getPanelShowMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getPanelHideMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelShowNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getPanelHideNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowShowMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getRowHideMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowShowNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getRowHideNotMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabShowMatches(dashboardPage, selectors)).not.toBeVisible();
    await expect(getTabHideMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabShowNotMatches(dashboardPage, selectors)).toBeVisible();
    await expect(getTabHideNotMatches(dashboardPage, selectors)).not.toBeVisible();
  });
});

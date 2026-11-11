import { type Locator, type Page } from '@playwright/test';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARDS_API = '/apis/dashboard.grafana.app/v2/namespaces/stacks-12345/dashboards';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1600, height: 1200 },
});

function tablePanel(id: number, title: string, csvContent: string) {
  return {
    kind: 'Panel',
    spec: {
      id,
      title,
      description: '',
      links: [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                refId: 'A',
                hidden: false,
                query: {
                  kind: 'DataQuery',
                  group: 'grafana-testdata-datasource',
                  version: 'v0',
                  datasource: { name: 'PD8C576611E62080A' },
                  spec: { scenarioId: 'csv_content', csvContent },
                },
              },
            },
          ],
          queryOptions: {},
          transformations: [],
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: 'table',
        version: '13.4.0',
        spec: { options: { showHeader: true }, fieldConfig: { defaults: {}, overrides: [] } },
      },
    },
  };
}

function gridItem(name: string, x: number) {
  return {
    kind: 'GridLayoutItem',
    spec: { element: { kind: 'ElementReference', name }, x, y: 0, width: 12, height: 9 },
  };
}

const dashboard = (title: string) => ({
  metadata: {
    annotations: { 'grafana.app/folder': '', 'grafana.app/grant-permissions': 'default' },
    generateName: 'e2e-table-adhoc-edit-',
  },
  spec: {
    title,
    annotations: [],
    cursorSync: 'Off',
    description: '',
    editable: true,
    links: [],
    liveNow: false,
    preload: false,
    tags: [],
    variables: [],
    timeSettings: {
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
      fiscalYearStartMonth: 0,
      from: 'now-6h',
      to: 'now',
      hideTimepicker: false,
      timezone: 'browser',
    },
    elements: {
      'panel-1': tablePanel(1, 'Services', 'service,region,errors\napi,us-east,3\nweb,eu-west,7\ndb,us-east,1'),
      'panel-2': tablePanel(2, 'Hosts', 'host,cpu,mem\nweb-01,42,70\nweb-02,55,64'),
    },
    layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-1', 0), gridItem('panel-2', 12)] } },
  },
});

const headerNames = (panel: Locator) => panel.locator('[role="columnheader"] button[title]').allTextContents();

async function hideColumn(page: Page, panel: Locator, selectors: E2ESelectorGroups, column: string) {
  await panel.getByLabel(`Column options for ${column}`).click();
  await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();
}

async function chooseAdHocChangesAction(page: Page, panel: Locator, selectors: E2ESelectorGroups, action: string) {
  await panel.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction).click();
  await page.getByRole('menuitem', { name: action }).click();
}

async function openPanelEditor(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, title: string) {
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title)).hover();
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(title)).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Edit')).click();
  await expect(
    dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
  ).toBeVisible();
}

test.describe('Panels test: Table - ad hoc changes in edit mode', { tag: ['@panels', '@table'] }, () => {
  let uid: string;

  test.beforeEach(async ({ request }, testInfo) => {
    const response = await request.post(DASHBOARDS_API, {
      data: dashboard(`Table ad hoc changes in edit mode ${testInfo.testId}`),
    });
    expect(response.ok()).toBeTruthy();
    uid = (await response.json()).metadata.name;
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`${DASHBOARDS_API}/${uid}`);
  });

  test('keeps ad hoc changes in edit mode and removes them from the panel header', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const services = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Services'));
    await waitForTableLoad(services);

    await hideColumn(page, services, selectors, 'region');
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
    ).toBeVisible();
    await expect.poll(() => headerNames(services)).toEqual(['service', 'errors']);

    await hideColumn(page, services, selectors, 'errors');
    await expect.poll(() => headerNames(services)).toEqual(['service']);

    await chooseAdHocChangesAction(page, services, selectors, 'Remove changes');
    await expect.poll(() => headerNames(services)).toEqual(['service', 'region', 'errors']);
    await expect(services.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction)).toBeHidden();
  });

  test('keeps ad hoc changes in the panel editor and after discarding its changes', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const services = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Services'));
    const backButton = dashboardPage.getByGrafanaSelector(
      selectors.components.NavToolbar.editDashboard.backToDashboardButton
    );
    await waitForTableLoad(services);

    await hideColumn(page, services, selectors, 'region');
    await openPanelEditor(dashboardPage, selectors, 'Services');
    await expect.poll(() => headerNames(services)).toEqual(['service', 'errors']);

    await hideColumn(page, services, selectors, 'errors');
    await expect.poll(() => headerNames(services)).toEqual(['service']);

    await page.getByRole('textbox', { name: 'Title' }).fill('Renamed services');
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton)
      .click();
    await expect(backButton).toBeHidden();
    await expect(services).toBeVisible();
    await expect.poll(() => headerNames(services)).toEqual(['service']);
    await expect(services.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction)).toBeVisible();
  });

  test('keeps ad hoc changes when the dashboard edit is discarded', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const services = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Services'));
    await waitForTableLoad(services);

    await hideColumn(page, services, selectors, 'region');
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await openPanelEditor(dashboardPage, selectors, 'Services');
    await page.getByRole('textbox', { name: 'Title' }).fill('Renamed services');
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton)
    ).toBeEnabled();
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
      .click();
    const renamed = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Renamed services'));
    await expect(renamed).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
    ).toHaveAttribute('data-testactive');

    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await page.getByTestId(selectors.pages.ConfirmModal.delete).click();

    await expect(services).toBeVisible();
    await expect.poll(() => headerNames(services)).toEqual(['service', 'errors']);
    await expect(services.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction)).toBeVisible();
  });

  test('saves a hidden column and a row filter to the dashboard from edit mode', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const services = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Services'));
    const saveDrawerButton = dashboardPage.getByGrafanaSelector(
      selectors.components.Drawer.DashboardSaveDrawer.saveButton
    );
    await waitForTableLoad(services);

    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await hideColumn(page, services, selectors, 'region');
    await services.getByLabel('Column options for service').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem).click();
    await page.getByRole('checkbox', { name: 'api', exact: true }).click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect.poll(() => headerNames(services)).toEqual(['service', 'errors']);
    await expect(services.getByRole('row')).toHaveCount(2);

    await chooseAdHocChangesAction(page, services, selectors, 'Save to dashboard');
    await saveDrawerButton.click();
    await expect(saveDrawerButton).toBeHidden();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
    ).toBeVisible();

    await page.reload();
    await waitForTableLoad(services);
    await expect.poll(() => headerNames(services)).toEqual(['service', 'errors']);
    await expect(services.getByRole('gridcell', { name: 'api' })).toBeVisible();
    await expect(services.getByRole('row')).toHaveCount(2);
    await expect(services.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction)).toBeHidden();
  });

  test('saves ad hoc changes to the dashboard from the panel editor', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const hosts = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Hosts'));
    const saveDrawerButton = dashboardPage.getByGrafanaSelector(
      selectors.components.Drawer.DashboardSaveDrawer.saveButton
    );
    await waitForTableLoad(hosts);

    await openPanelEditor(dashboardPage, selectors, 'Hosts');
    await hideColumn(page, hosts, selectors, 'mem');
    await chooseAdHocChangesAction(page, hosts, selectors, 'Save to dashboard');
    await saveDrawerButton.click();
    await expect(saveDrawerButton).toBeHidden();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
    ).toBeVisible();
    await expect.poll(() => headerNames(hosts)).toEqual(['host', 'cpu']);

    await page.reload();
    await waitForTableLoad(hosts);
    await expect.poll(() => headerNames(hosts)).toEqual(['host', 'cpu']);
  });
});

import { type Locator, type Page } from '@playwright/test';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARDS_API = '/apis/dashboard.grafana.app/v2/namespaces/stacks-12345/dashboards';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1600, height: 1200 },
});

const dashboard = (title: string) => ({
  metadata: {
    annotations: { 'grafana.app/folder': '', 'grafana.app/grant-permissions': 'default' },
    generateName: 'e2e-table-adhoc-data-',
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
    variables: [
      {
        kind: 'CustomVariable',
        spec: {
          name: 'second',
          label: 'Second column',
          query: 'region, zone',
          current: { text: 'region', value: 'region' },
          options: [
            { text: 'region', value: 'region' },
            { text: 'zone', value: 'zone' },
          ],
          hide: 'dontHide',
          skipUrlSync: false,
          multi: false,
          includeAll: false,
          allowCustomValue: false,
        },
      },
    ],
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
      'panel-1': {
        kind: 'Panel',
        spec: {
          id: 1,
          title: 'Services',
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
                      spec: {
                        scenarioId: 'csv_content',
                        csvContent: 'service,$second,errors\napi,us-east,3\nweb,eu-west,7\ndb,us-east,1',
                      },
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
      },
    },
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'panel-1' }, x: 0, y: 0, width: 12, height: 9 },
          },
        ],
      },
    },
  },
});

const headerNames = (panel: Locator) => panel.locator('[role="columnheader"] button[title]').allTextContents();

async function hideColumn(page: Page, panel: Locator, selectors: E2ESelectorGroups, column: string) {
  await panel.getByLabel(`Column options for ${column}`).click();
  await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();
}

async function chooseSecondColumn(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  from: string,
  to: string
) {
  await dashboardPage
    .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(from))
    .click();
  await page.getByRole('option', { name: to, exact: true }).click();
}

test.describe('Panels test: Table - ad hoc changes when the data changes', { tag: ['@panels', '@table'] }, () => {
  let uid: string;

  test.beforeEach(async ({ request }, testInfo) => {
    const response = await request.post(DASHBOARDS_API, {
      data: dashboard(`Table ad hoc changes when the data changes ${testInfo.testId}`),
    });
    expect(response.ok()).toBeTruthy();
    uid = (await response.json()).metadata.name;
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`${DASHBOARDS_API}/${uid}`);
  });

  test('stops showing ad hoc changes while the data no longer has their columns', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const services = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Services'));
    const adHocChanges = services.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction);
    await waitForTableLoad(services);

    await hideColumn(page, services, selectors, 'region');
    await expect(adHocChanges).toBeVisible();

    await chooseSecondColumn(page, dashboardPage, selectors, 'region', 'zone');
    await expect.poll(() => headerNames(services)).toEqual(['service', 'zone', 'errors']);
    await expect(adHocChanges).toBeHidden();

    await chooseSecondColumn(page, dashboardPage, selectors, 'zone', 'region');
    await expect.poll(() => headerNames(services)).toEqual(['service', 'errors']);
    await expect(adHocChanges).toBeVisible();
  });

  test('saves only the ad hoc changes that still apply to the data', async ({
    gotoDashboardPage,
    selectors,
    page,
    request,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const services = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Services'));
    const saveDrawerButton = dashboardPage.getByGrafanaSelector(
      selectors.components.Drawer.DashboardSaveDrawer.saveButton
    );
    await waitForTableLoad(services);

    await hideColumn(page, services, selectors, 'region');
    await hideColumn(page, services, selectors, 'errors');
    await chooseSecondColumn(page, dashboardPage, selectors, 'region', 'zone');
    await expect.poll(() => headerNames(services)).toEqual(['service', 'zone']);

    await services.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction).click();
    await page.getByRole('menuitem', { name: 'Save to dashboard' }).click();
    await saveDrawerButton.click();
    await expect(saveDrawerButton).toBeHidden();

    const saved = await (await request.get(`${DASHBOARDS_API}/${uid}`)).json();
    const transformations = saved.spec.elements['panel-1'].spec.data.spec.transformations;
    expect(transformations.map(({ spec }: { spec: { options: object } }) => spec.options)).toEqual([
      { excludeByName: { errors: true }, indexByName: {}, renameByName: {} },
    ]);
  });
});

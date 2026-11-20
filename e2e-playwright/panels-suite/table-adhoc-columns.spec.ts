import { type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';
const TESTDATA = { type: 'grafana-testdata-datasource', uid: 'PD8C576611E62080A' };

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1600, height: 1200 },
});

const headerNames = (panel: Locator) => panel.locator('[role="columnheader"] button[title]').allTextContents();

const displayNameDashboard = (uid: string) => ({
  uid,
  title: `Table display name overrides ${uid}`,
  schemaVersion: 41,
  panels: [
    {
      id: 1,
      type: 'table',
      title: 'Display name overrides',
      gridPos: { h: 12, w: 24, x: 0, y: 0 },
      datasource: TESTDATA,
      targets: [
        {
          refId: 'A',
          datasource: TESTDATA,
          scenarioId: 'csv_content',
          csvContent:
            'customer_id,region_name,request_count\ncustomer-a,us-east,10\ncustomer-b,eu-west,20\ncustomer-c,us-east,30',
        },
      ],
      fieldConfig: {
        defaults: { custom: { filterable: true } },
        overrides: [
          ['customer_id', 'Customer'],
          ['region_name', 'Region'],
          ['request_count', 'Requests'],
        ].map(([name, displayName]) => ({
          matcher: { id: 'byName', options: name },
          properties: [{ id: 'displayName', value: displayName }],
        })),
      },
      options: { showHeader: true, showColumnsSidebar: true, cellHeight: 'sm' },
    },
  ],
});

const labelVariable = (name: string, values: string[]) => ({
  name,
  type: 'custom',
  query: values.join(','),
  current: { text: values[0], value: values[0] },
  options: values.map((value, index) => ({ text: value, value, selected: index === 0 })),
});

const upstreamRenameDashboard = (uid: string) => ({
  uid,
  title: `Table upstream renames ${uid}`,
  schemaVersion: 41,
  templating: {
    list: [labelVariable('hostLabel', ['host', 'Host name']), labelVariable('regionLabel', ['region', 'host'])],
  },
  panels: [
    {
      id: 1,
      type: 'table',
      title: 'Upstream renames',
      gridPos: { h: 12, w: 24, x: 0, y: 0 },
      datasource: TESTDATA,
      targets: [
        {
          refId: 'A',
          datasource: TESTDATA,
          scenarioId: 'csv_content',
          csvContent: 'id,host,region\n1,web-1,us-east\n2,web-2,eu-west\n3,db-1,us-east',
        },
      ],
      transformations: [
        {
          id: 'organize',
          options: {
            excludeByName: {},
            indexByName: {},
            renameByName: { host: '$hostLabel', region: '$regionLabel' },
          },
        },
      ],
      fieldConfig: { defaults: { custom: { filterable: true } }, overrides: [] },
      options: { showHeader: true, showColumnsSidebar: true, cellHeight: 'sm' },
    },
  ],
});

test.describe('Panels test: Table - ad-hoc columns', { tag: ['@panels', '@table'] }, () => {
  test('restores a hidden column with its values', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-10' }),
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Apply to Row - mixed color cell types')
    );

    await waitForTableLoad(panel);
    expect(await headerNames(panel)).toEqual(['use-case', 'normal', 'color-text', 'color-bg', 'highlight']);

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

    await panel.getByLabel('Column options for use-case').click();
    await page.getByTestId(menu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['normal', 'color-text', 'color-bg', 'highlight']);

    await panel.getByLabel('Column options for normal').click();
    await page.getByTestId(menu.manageColumnsItem).click();

    await expect(panel.getByTestId(sidebar.container)).toBeVisible();
    await expect(panel.getByTestId(sidebar.row('use-case'))).toBeVisible();

    // The checkbox input is visually hidden behind its styled control.
    await panel.getByTestId(sidebar.row('use-case')).getByRole('checkbox').click({ force: true });

    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'normal', 'color-text', 'color-bg', 'highlight']);

    await expect(panel.getByRole('gridcell').filter({ hasText: 'color bg and apply to row' })).toBeVisible();
    await expect(panel.getByRole('gridcell').filter({ hasText: 'no colorization' })).toBeVisible();
    await panel.getByTestId(sidebar.row('normal')).getByRole('button', { name: 'Reorder normal' }).press('ArrowUp');
    await expect.poll(() => headerNames(panel)).toEqual(['normal', 'use-case', 'color-text', 'color-bg', 'highlight']);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => headerNames(panel)).toEqual(['normal', 'use-case', 'color-text', 'color-bg', 'highlight']);
  });
});

test.describe('Panels test: Table - ad-hoc columns with display names', { tag: ['@panels', '@table'] }, () => {
  let uid: string;

  test.beforeEach(async ({ request }) => {
    uid = randomUUID();
    const response = await request.post('/api/dashboards/db', { data: { dashboard: displayNameDashboard(uid) } });
    expect(response.ok()).toBeTruthy();
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/dashboards/uid/${uid}`);
  });

  test('hides and reorders columns renamed by display name overrides', async ({
    gotoDashboardPage,
    request,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Display name overrides'));
    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;
    const toggleColumn = (name: string) =>
      panel.getByTestId(sidebar.row(name)).getByRole('checkbox').click({ force: true });

    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['Customer', 'Region', 'Requests']);
    await expect(panel.getByTestId(sidebar.row('Customer'))).toBeVisible();

    await toggleColumn('Customer');
    await expect.poll(() => headerNames(panel)).toEqual(['Region', 'Requests']);

    await panel.getByLabel('Column options for Requests').click();
    await page.getByTestId(menu.hideItem).click();
    await expect.poll(() => headerNames(panel)).toEqual(['Region']);

    await toggleColumn('Customer');
    await toggleColumn('Requests');
    await expect.poll(() => headerNames(panel)).toEqual(['Customer', 'Region', 'Requests']);

    await panel.getByRole('button', { name: 'Reorder Requests' }).dragTo(panel.getByTestId(sidebar.row('Customer')));
    await expect.poll(() => headerNames(panel)).toEqual(['Requests', 'Customer', 'Region']);

    await panel.getByLabel('Column options for Region').click();
    await page.getByTestId(menu.filterItem).click();
    await page.getByRole('checkbox', { name: 'eu-west', exact: true }).click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await toggleColumn('Region');
    await expect.poll(() => headerNames(panel)).toEqual(['Requests', 'Customer']);
    await expect(panel.getByRole('row')).toHaveCount(2);
    await expect(panel.getByRole('gridcell', { name: 'customer-b' })).toBeVisible();

    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await panel.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction).click();
    await page.getByRole('menuitem', { name: 'Save to dashboard' }).click();
    const saveButton = dashboardPage.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton);
    await saveButton.click();
    await expect(saveButton).toBeHidden();

    const saved = await (await request.get(`/api/dashboards/uid/${uid}`)).json();
    expect(saved.dashboard.panels[0].transformations).toContainEqual(
      expect.objectContaining({
        id: 'organize',
        options: expect.objectContaining({
          excludeByName: { region_name: true },
          indexByName: { request_count: 0, customer_id: 1, region_name: 2 },
        }),
      })
    );

    await page.reload();
    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['Requests', 'Customer']);
    await expect(panel.getByRole('gridcell', { name: 'customer-b' })).toBeVisible();
    await expect(panel.getByRole('row')).toHaveCount(2);
  });
});

test.describe('Panels test: Table - ad-hoc columns with upstream renames', { tag: ['@panels', '@table'] }, () => {
  let uid: string;

  test.beforeEach(async ({ request }) => {
    uid = randomUUID();
    const response = await request.post('/api/dashboards/db', { data: { dashboard: upstreamRenameDashboard(uid) } });
    expect(response.ok()).toBeTruthy();
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/dashboards/uid/${uid}`);
  });

  test('keeps ad hoc changes on the same columns when an upstream organize renames them', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    test.slow();
    const dashboardPage = await gotoDashboardPage({ uid });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Upstream renames'));
    const table = selectors.components.Panels.Visualization.TableNG;
    const pickValue = async (current: string, next: string) => {
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(current))
        .click();
      await page.getByRole('option', { name: next, exact: true }).click();
    };
    const firstColumn = () => panel.getByRole('row').locator('[role="gridcell"]:first-child').allTextContents();

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(table.headerColumnMenu.hideItem).click();
    await panel.getByRole('button', { name: 'Reorder region' }).press('ArrowUp');
    await panel.getByRole('button', { name: 'Reorder region' }).press('ArrowUp');
    await panel.getByLabel('Column options for region').click();
    await page.getByTestId(table.headerColumnMenu.filterItem).click();
    await page.getByRole('checkbox', { name: 'us-east', exact: true }).click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'id']);
    await expect.poll(firstColumn).toEqual(['us-east', 'us-east']);

    await pickValue('host', 'Host name');
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'id']);
    await expect(panel.getByTestId(table.columnsSidebar.row('Host name')).getByRole('checkbox')).not.toBeChecked();
    await expect.poll(firstColumn).toEqual(['us-east', 'us-east']);

    await pickValue('region', 'host');
    await expect.poll(() => headerNames(panel)).toEqual(['host', 'id']);
    await expect.poll(firstColumn).toEqual(['us-east', 'us-east']);

    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await panel.getByTestId(selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction).click();
    await page.getByRole('menuitem', { name: 'Save to dashboard' }).click();
    const saveButton = dashboardPage.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton);
    await saveButton.click();
    await expect(saveButton).toBeHidden();
    await expect.poll(() => headerNames(panel)).toEqual(['host', 'id']);

    await page.reload();
    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['host', 'id']);
    await expect.poll(firstColumn).toEqual(['us-east', 'us-east']);
    await pickValue('host', 'region');
    await pickValue('Host name', 'host');
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'id']);
    await expect.poll(firstColumn).toEqual(['us-east', 'us-east']);
  });
});

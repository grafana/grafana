import { type Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'table-adhoc-columns';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1600, height: 1200 },
});

const headerNames = (panel: Locator) => panel.locator('[role="columnheader"] button[title]').allTextContents();

test.describe('Panels test: Table - ad-hoc columns', { tag: ['@panels', '@table'] }, () => {
  test('restores a hidden column with its values', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    expect(await headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(menu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'cpu', 'mem']);

    await panel.getByLabel('Column options for region').click();
    await page.getByTestId(menu.manageColumnsItem).click();

    await expect(panel.getByTestId(sidebar.container)).toBeVisible();
    await expect(panel.getByTestId(sidebar.row('host'))).toBeVisible();

    // The checkbox input is visually hidden behind its styled control.
    await panel.getByTestId(sidebar.visibilityToggle('host')).click({ force: true });

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);

    await expect(panel.getByRole('gridcell').filter({ hasText: 'web-1' })).toBeVisible();
    await expect(panel.getByRole('gridcell').filter({ hasText: 'web-4' })).toBeVisible();
  });

  test('excludes hidden columns from field override choices', async ({ gotoDashboardPage, selectors, page }) => {
    let queryRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/api/ds/query')) {
        queryRequests++;
      }
    });

    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));
    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

    await waitForTableLoad(panel);
    const initialQueryRequests = queryRequests;

    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(menu.hideItem).click();
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'cpu', 'mem']);

    await dashboardPage.getByGrafanaSelector(selectors.components.ValuePicker.button('Add field override')).click();
    await page.getByRole('option', { name: 'Fields with name', exact: true }).click();

    const fieldNameMatcher = page.getByPlaceholder('Choose').last();
    await fieldNameMatcher.click();
    await expect(page.getByRole('option', { name: 'host', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await panel.getByLabel('Column options for region').click();
    await page.getByTestId(menu.manageColumnsItem).click();
    await panel.getByTestId(sidebar.visibilityToggle('host')).click({ force: true });
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);

    await fieldNameMatcher.click();
    await expect(page.getByRole('option', { name: 'host', exact: true })).toBeVisible();
    expect(queryRequests).toBe(initialQueryRequests);
  });

  test('enables filtering on every column', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;

    for (const column of ['region', 'host', 'cpu', 'mem']) {
      await panel.getByLabel(`Column options for ${column}`).click();
      await expect(page.getByTestId(menu.filterItem)).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('does not offer pinning', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for host').click();

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    await expect(page.getByTestId(menu.hideItem)).toBeVisible();
    await expect(page.getByTestId(menu.pinItem)).toBeHidden();
  });

  test('retains column state across data refreshes', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for cpu').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'mem']);

    await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();
    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'mem']);
  });

  test('resets column state on page reload', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'cpu', 'mem']);

    await page.reload();
    await waitForTableLoad(panel);

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);
  });

  test('scopes column state to the selected frame', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Ad-hoc columns, two frames')
    );

    await waitForTableLoad(panel);
    expect(await headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);

    await panel.getByLabel('Column options for cpu').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'mem']);

    await panel.getByRole('combobox').first().click();
    await page.getByRole('option').nth(1).click();

    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);
  });

  test('applies column state after saved transformations', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Ad-hoc columns over a panel transformation')
    );

    await waitForTableLoad(panel);
    expect(await headerNames(panel)).toEqual(['mem', 'region', 'host', 'cpu']);

    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['mem', 'region', 'cpu']);
  });

  test('initializes the sidebar from the panel option', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Ad-hoc columns with the sidebar open')
    );

    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

    await waitForTableLoad(panel);
    await expect(panel.getByTestId(sidebar.container)).toBeVisible();

    await panel.getByTestId(sidebar.closeButton).click();
    await expect(panel.getByTestId(sidebar.container)).toBeHidden();
  });

  test(
    'has no accessibility violations',
    { tag: ['@a11y'] },
    async ({ gotoDashboardPage, scanForA11yViolations, selectors }) => {
      const panelTitle = 'Ad-hoc columns with the sidebar open';
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle));

      await waitForTableLoad(panel);
      await expect(
        panel.getByTestId(selectors.components.Panels.Visualization.TableNG.columnsSidebar.container)
      ).toBeVisible();

      // The scan context is serialized into the page, so it requires a CSS selector.
      const report = await scanForA11yViolations({
        include: `[data-testid="${selectors.components.Panels.Panel.title(panelTitle)}"]`,
        options: {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
        },
      });

      expect(report.violations).toHaveLength(0);
    }
  );
});

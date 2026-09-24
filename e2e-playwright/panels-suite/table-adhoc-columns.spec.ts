import { type Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1600, height: 1200 },
});

const headerNames = (panel: Locator) => panel.locator('[role="columnheader"] button[title]').allTextContents();

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
    await panel.getByTestId(sidebar.visibilityToggle('use-case')).click({ force: true });

    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'normal', 'color-text', 'color-bg', 'highlight']);

    await expect(panel.getByRole('gridcell').filter({ hasText: 'color bg and apply to row' })).toBeVisible();
    await expect(panel.getByRole('gridcell').filter({ hasText: 'no colorization' })).toBeVisible();
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
      queryParams: new URLSearchParams({ editPanel: '10' }),
    });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Apply to Row - mixed color cell types')
    );
    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

    await waitForTableLoad(panel);
    const initialQueryRequests = queryRequests;

    await panel.getByLabel('Column options for normal').click();
    await page.getByTestId(menu.hideItem).click();
    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'color-text', 'color-bg', 'highlight']);

    await dashboardPage.getByGrafanaSelector(selectors.components.ValuePicker.button('Add field override')).click();
    await page
      .getByRole('option', { name: 'Fields with name Set properties for a specific field', exact: true })
      .click();

    const fieldNameMatcher = page.getByPlaceholder('Choose').last();
    await fieldNameMatcher.click();
    await expect(page.getByRole('option', { name: 'normal', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await panel.getByLabel('Column options for use-case').click();
    await page.getByTestId(menu.manageColumnsItem).click();
    await panel.getByTestId(sidebar.visibilityToggle('normal')).click({ force: true });
    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'normal', 'color-text', 'color-bg', 'highlight']);

    await fieldNameMatcher.click();
    await expect(page.getByRole('option', { name: 'normal', exact: true })).toBeVisible();
    expect(queryRequests).toBe(initialQueryRequests);
  });

  test('enables filtering on every column', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-10' }),
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Apply to Row - mixed color cell types')
    );

    await waitForTableLoad(panel);

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;

    for (const column of ['use-case', 'normal', 'color-text', 'color-bg', 'highlight']) {
      await panel.getByLabel(`Column options for ${column}`).click();
      await expect(page.getByTestId(menu.filterItem)).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('pins a column first and preserves its order after unpinning', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-10' }),
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Apply to Row - mixed color cell types')
    );

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for normal').click();

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    await expect(page.getByTestId(menu.pinItem)).toHaveText('Pin column left');
    await page.getByTestId(menu.pinItem).click();
    await expect.poll(() => headerNames(panel)).toEqual(['normal', 'use-case', 'color-text', 'color-bg', 'highlight']);

    await panel.getByLabel('Column options for normal').click();
    await expect(page.getByTestId(menu.pinItem)).toHaveText('Unpin column');
    await page.getByTestId(menu.pinItem).click();
    await expect.poll(() => headerNames(panel)).toEqual(['normal', 'use-case', 'color-text', 'color-bg', 'highlight']);

    await panel.getByLabel('Column options for normal').click();
    await expect(page.getByTestId(menu.pinItem)).toHaveText('Pin column left');
  });

  test('retains column state across data refreshes', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-10' }),
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Apply to Row - mixed color cell types')
    );

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for color-text').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'normal', 'color-bg', 'highlight']);

    const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/api/ds/query'));
    await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();
    await refreshed;
    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'normal', 'color-bg', 'highlight']);
  });

  test('resets column state on page reload', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-10' }),
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Apply to Row - mixed color cell types')
    );

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for normal').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'color-text', 'color-bg', 'highlight']);

    await page.reload();
    await waitForTableLoad(panel);

    await expect.poll(() => headerNames(panel)).toEqual(['use-case', 'normal', 'color-text', 'color-bg', 'highlight']);
  });

  test('scopes column state to the selected frame', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-11' }),
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Multi-frame table'));

    await waitForTableLoad(panel);
    await expect(panel.getByLabel('Column options for Info')).toBeVisible();
    await panel.getByLabel('Column options for Info').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect(panel.getByLabel('Column options for Info')).toBeHidden();

    await panel.getByRole('combobox').first().click();
    await page.getByRole('option').nth(1).click();

    await waitForTableLoad(panel);
    await expect(panel.getByLabel('Column options for Info')).toBeVisible();
    await panel.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();
    await expect(panel.getByLabel('Column options for Info')).toBeHidden();
  });

  test('applies column state after saved transformations', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-1' }),
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'));

    await waitForTableLoad(panel);
    await expect(panel.getByLabel('Column options for Long Text')).toBeVisible();
    await panel.getByLabel('Column options for Long Text').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect(panel.getByLabel('Column options for Long Text')).toBeHidden();
    const table = selectors.components.Panels.Visualization.TableNG;
    await panel.getByTestId(table.headerColumnMenu.button).first().click();
    await page.getByTestId(table.headerColumnMenu.manageColumnsItem).click();
    await panel.getByTestId(table.columnsSidebar.visibilityToggle('Long Text')).click({ force: true });
    await expect(panel.getByLabel('Column options for Long Text')).toBeVisible();
  });

  test('initializes the sidebar from the panel option', async ({ gotoPanelEditPage, selectors }) => {
    const editor = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '10' });
    const options = editor.getCustomOptions('Table');
    await options.expand();
    await options.getSwitch('Show columns sidebar').check();
    const dashboardPage = await editor.backToDashboard();
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Apply to Row - mixed color cell types')
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
    async ({ gotoDashboardPage, scanForA11yViolations, selectors, page }) => {
      const panelTitle = 'Apply to Row - mixed color cell types';
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ viewPanel: 'panel-10' }),
      });
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle));

      await waitForTableLoad(panel);
      await panel.getByLabel('Column options for normal').click();
      await page
        .getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.manageColumnsItem)
        .click();
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

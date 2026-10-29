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

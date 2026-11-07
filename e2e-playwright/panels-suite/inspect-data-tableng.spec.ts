import { readFile } from 'fs/promises';
import { type Locator } from 'playwright-core';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';
const PANEL_TITLE = 'Table - Kitchen Sink';

test.use({
  openFeature: {
    flags: {
      'table.inspectDataTableNG': true,
    },
  },
});

function header(grid: Locator, name: string) {
  return grid.getByRole('columnheader').getByRole('button', { name, exact: true });
}

async function openInspectData(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  const panelMenu = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_TITLE));
  await panelMenu.click({ force: true });
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Inspect')).hover();
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Data')).click();

  const content = dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Data.content);
  await expect(content).toBeVisible();
  return content;
}

test.describe('Panel inspect: Data tab with TableNG', { tag: ['@panels', '@table'] }, () => {
  test('renders query frames in TableNG and switches frames and transforms', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const content = await openInspectData(dashboardPage, selectors);
    const grid = content.locator('.rdg:not([aria-hidden="true"])');

    // First query is random_walk_table, untransformed.
    await expect(header(grid, 'State')).toBeVisible();

    await content.getByText('Data options').click();
    await content.getByLabel('Select dataframe').click();
    await page.getByRole('option', { name: /\(1\)$/ }).click();

    await expect(header(grid, 'Info')).toBeVisible();
    await expect(grid.getByRole('gridcell', { name: 'up fast', exact: true })).toBeVisible();
    await expect(header(grid, 'State')).toHaveCount(0);

    // Panel transforms join both queries by Info into one frame.
    await content.getByRole('switch', { name: 'Apply panel transformations' }).click({ force: true });
    await expect(header(grid, 'State')).toBeVisible();
    await expect(header(grid, 'Image')).toBeVisible();
  });

  test('Download CSV matches the selected frame, raw and formatted', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const content = await openInspectData(dashboardPage, selectors);
    await content.getByText('Data options').click();

    const downloadCsv = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        content.getByRole('button', { name: 'Download CSV' }).click(),
      ]);
      const path = await download.path();
      return (await readFile(path, 'utf8')).trim().split(/\r?\n/);
    };

    // Random walk table frame. Formatted data is on by default and applies the panel's m² unit to Min.
    const formatted = await downloadCsv();
    expect(formatted[0]).toBe('"Time","A","Min","Max","Info","State"');
    expect(formatted[1].split(',')[2]).toMatch(/^-?\d+(\.\d+)? m²$/);

    await content.getByRole('switch', { name: 'Formatted data' }).click({ force: true });
    const raw = await downloadCsv();
    expect(raw[0]).toBe(formatted[0]);
    const [rawTime, , rawMin] = raw[1].split(',');
    expect(rawTime).toMatch(/^\d{13}$/);
    expect(rawMin).toMatch(/^-?\d+(\.\d+)?$/);

    await content.getByLabel('Select dataframe').click();
    await page.getByRole('option', { name: /\(1\)$/ }).click();
    const csvFrame = await downloadCsv();
    expect(csvFrame[0]).toBe('"Info","Image","Image w/ Link","Pills","Data Link","Long Text","Styling"');
    expect(csvFrame.slice(1).map((line) => line.split(',')[0])).toEqual(['down', 'up', 'up fast', 'down fast']);
  });
});

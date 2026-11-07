import { type Locator, type Page } from '@playwright/test';

import { test, expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';
const SOLO_PANEL = `${DASHBOARD_UID}/panel-tests-table-kitchen-sink?orgId=1&panelId=1`;
const USER = 'table-i18n-zoom';
const PASSWORD = 'table-i18n-zoom';

// A separate user keeps the language change away from other tests.
test.use({
  viewport: { width: 1600, height: 1000 },
  user: { user: USER, password: PASSWORD },
  storageState: { cookies: [], origins: [] },
  openFeature: {
    flags: {
      'table.refresh': true,
      'table.refreshNewFeatures': true,
    },
  },
});

const tableNG = (selectors: E2ESelectorGroups) => selectors.components.Panels.Visualization.TableNG;

const gotoSoloTable = async (page: Page, selectors: E2ESelectorGroups) => {
  await page.goto(selectors.pages.SoloPanel.url(SOLO_PANEL));
  await waitForTableLoad(page);
  return page.locator('.rdg:not([aria-hidden="true"])').first();
};

const headerTexts = (table: Locator) =>
  table
    .getByRole('columnheader')
    .evaluateAll((cells) => cells.map((c) => c.querySelector('button[title]')?.textContent ?? ''));

test.describe('Panels test: Table - translated and zoomed', { tag: ['@panels', '@table'] }, () => {
  const loginAsGerman = async (page: Page, selectors: E2ESelectorGroups, createUser: () => Promise<void>) => {
    await createUser();
    await page.getByTestId(selectors.pages.Login.username).fill(USER);
    await page.getByTestId(selectors.pages.Login.password).fill(PASSWORD);
    await page.getByTestId(selectors.pages.Login.submit).click();
    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
    const res = await page.request.put('/api/user/preferences', { data: { language: 'de-DE' } });
    expect(res.ok()).toBe(true);
  };

  // i18n keys look like `grafana-ui.table.column-menu-hide`.
  const RAW_KEY = /\b[a-z0-9-]+(\.[a-z0-9-]+){2,}\b/;

  test('table labels and tooltips are translated with no raw keys', async ({ page, selectors, createUser }) => {
    await loginAsGerman(page, selectors, createUser);
    const table = await gotoSoloTable(page, selectors);
    const columns = await headerTexts(table);

    const menuButton = table.getByTestId(tableNG(selectors).headerColumnMenu.button).first();
    await menuButton.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const menuLabels = [await menu.getAttribute('aria-label'), ...(await menu.getByRole('menuitem').allTextContents())];
    await page.getByTestId(tableNG(selectors).headerColumnMenu.manageColumnsItem).click();
    const sidebar = page.getByTestId(tableNG(selectors).columnsSidebar.container);
    await expect(sidebar).toBeVisible();

    const labels = [
      ...menuLabels,
      await sidebar.getAttribute('aria-label'),
      ...(await sidebar.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))),
      ...(await table
        .locator('[aria-label], [title]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.getAttribute('title')))),
    ];

    for (const label of labels) {
      expect(label, 'label is not empty').toBeTruthy();
      expect(label, `"${label}" is not a raw i18n key`).not.toMatch(RAW_KEY);
    }
    expect(columns.length).toBeGreaterThan(0);
  });

  test('table, menus and sidebar reflow at 200% zoom', async ({ page, selectors, createUser }) => {
    await loginAsGerman(page, selectors, createUser);
    // 200% browser zoom on a 1600x1000 window gives an 800x500 CSS viewport.
    await page.setViewportSize({ width: 800, height: 500 });
    const table = await gotoSoloTable(page, selectors);
    const viewport = page.viewportSize()!;

    const firstHeader = table.getByRole('columnheader').first();
    const label = (await firstHeader.locator('button[title]').boundingBox())!;
    const menuButton = firstHeader.getByTestId(tableNG(selectors).headerColumnMenu.button);
    const button = (await menuButton.boundingBox())!;
    expect(label.x + label.width, 'header label does not run under the column menu').toBeLessThanOrEqual(button.x + 1);

    await menuButton.click();
    const menu = (await page.getByRole('menu').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width);

    await page.getByTestId(tableNG(selectors).headerColumnMenu.manageColumnsItem).click();
    const sidebarLocator = page.getByTestId(tableNG(selectors).columnsSidebar.container);
    await expect(sidebarLocator).toBeVisible();
    const sidebar = (await sidebarLocator.boundingBox())!;
    const grid = (await table.boundingBox())!;
    expect(sidebar.width, 'sidebar has room for its content').toBeGreaterThan(80);
    expect(sidebar.x + sidebar.width, 'sidebar does not overlap the grid').toBeLessThanOrEqual(grid.x + 1);

    const clipped = await sidebarLocator.locator('button, input, span').evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetWidth > 0 && e.scrollWidth > (e as HTMLElement).offsetWidth + 1)
        .filter((e) => getComputedStyle(e).overflowX !== 'visible' && getComputedStyle(e).textOverflow !== 'ellipsis')
        .map((e) => e.outerHTML.slice(0, 80))
    );
    expect(clipped, 'sidebar controls are not clipped').toEqual([]);
  });
});

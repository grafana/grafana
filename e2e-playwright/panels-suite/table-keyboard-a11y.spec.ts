import { type Locator, type Page } from '@playwright/test';

import { test, expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';
const SOLO_PANEL = `${DASHBOARD_UID}/panel-tests-table-kitchen-sink?orgId=1&panelId=1`;

test.use({
  viewport: { width: 1600, height: 1000 },
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

const focused = (page: Page) => page.locator(':focus');

const focusIsInTable = (page: Page) =>
  page.evaluate(() => Boolean(document.activeElement?.closest('.rdg:not([aria-hidden="true"])')));

// Found by test id so it still resolves while its open menu hides the rest of the page from the a11y tree.
const columnMenuButton = (page: Page, selectors: E2ESelectorGroups, columnName: string) =>
  page
    .getByTestId(tableNG(selectors).headerColumnMenu.button)
    .and(page.locator(`[aria-label="Column options for ${columnName}"]`));

/** Presses Tab (or Shift+Tab) until the target has focus. */
const tabTo = (page: Page, target: Locator, key: 'Tab' | 'Shift+Tab' = 'Tab') =>
  expect(async () => {
    await page.keyboard.press(key);
    await expect(target).toBeFocused({ timeout: 100 });
  }).toPass({ timeout: 10_000, intervals: [0] });

/** Tabs from the top of the page until the given header's column menu button has focus. */
const tabToColumnMenu = async (page: Page, selectors: E2ESelectorGroups, columnName: string) => {
  const menuButton = page.getByRole('button', { name: `Column options for ${columnName}`, exact: true });
  await page.mouse.click(1, 1);
  await tabTo(page, menuButton);
  return columnMenuButton(page, selectors, columnName);
};

test.describe('Panels test: Table - keyboard and screen reader', { tag: ['@panels', '@table'] }, () => {
  test.describe('keyboard only', () => {
    test('header tab order follows the visual column order', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      const columns = await headerTexts(table);

      await page.mouse.click(1, 1);
      const visited: string[] = [];
      for (let i = 0; i < columns.length * 2 + 4; i++) {
        await page.keyboard.press('Tab');
        const colIndex = await focused(page).evaluate((el) =>
          el.closest('[role="columnheader"]')?.getAttribute('aria-colindex')
        );
        if (colIndex && visited.at(-1) !== colIndex) {
          visited.push(colIndex);
        }
      }

      expect(visited).toEqual(columns.map((_, i) => String(i + 1)));
    });

    test('header menu opens with Enter, arrows move through it, and Escape returns focus', async ({
      page,
      selectors,
    }) => {
      await gotoSoloTable(page, selectors);
      const menuButton = await tabToColumnMenu(page, selectors, 'Info');

      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu', { name: 'Column options for Info' });
      await expect(menu).toBeVisible();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      await expect(focused(page)).toHaveAttribute('role', 'menuitem');

      await page.keyboard.press('ArrowDown');
      await expect(focused(page)).toHaveAttribute('data-testid', tableNG(selectors).headerColumnMenu.hideItem);

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(menuButton).toBeFocused();
    });

    test('filter popup opened from the header menu takes focus and can be applied by keyboard', async ({
      page,
      selectors,
    }) => {
      const table = await gotoSoloTable(page, selectors);
      const menuButton = await tabToColumnMenu(page, selectors, 'Info');
      await page.keyboard.press('Enter');
      await expect(focused(page)).toHaveAttribute('data-testid', tableNG(selectors).headerColumnMenu.filterItem);
      await page.keyboard.press('Enter');

      const filterContainer = page.getByTestId(tableNG(selectors).Filters.Container);
      await expect(filterContainer).toBeVisible();
      await expect(async () => {
        expect(await filterContainer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }, 'focus moves into the filter popup').toPass({ timeout: 5_000 });

      const rowCount = await table.getAttribute('aria-rowcount');
      // Narrow to one value, select it, then confirm with Ok.
      await page.keyboard.type('down');
      await tabTo(page, filterContainer.getByTestId(tableNG(selectors).Filters.SelectAll).locator('input'));
      await page.keyboard.press('Space');
      await tabTo(page, filterContainer.getByRole('button', { name: 'Ok' }));
      await page.keyboard.press('Enter');

      await expect(filterContainer).toBeHidden();
      await expect(table).not.toHaveAttribute('aria-rowcount', rowCount!);
      await expect(page.getByTestId(tableNG(selectors).headerColumnMenu.activeFilterButton)).toBeVisible();
      await expect(
        menuButton.or(page.getByTestId(tableNG(selectors).headerColumnMenu.activeFilterButton))
      ).toBeFocused();
    });

    test('a column can be hidden from the header menu', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      await tabToColumnMenu(page, selectors, 'Info');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await expect(focused(page)).toHaveAttribute('data-testid', tableNG(selectors).headerColumnMenu.hideItem);
      await page.keyboard.press('Enter');

      await expect(table.getByRole('columnheader', { name: 'Info', exact: true })).toHaveCount(0);
      expect(await focusIsInTable(page), 'focus stays in the table after hiding a column').toBe(true);
    });

    test('columns can be reordered from the columns sidebar', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      const before = await headerTexts(table);
      await tabToColumnMenu(page, selectors, before[0]);
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await expect(focused(page)).toHaveAttribute('data-testid', tableNG(selectors).headerColumnMenu.manageColumnsItem);
      await page.keyboard.press('Enter');

      const sidebar = page.getByTestId(tableNG(selectors).columnsSidebar.container);
      await expect(sidebar).toBeFocused();

      const reorderHandle = sidebar.getByRole('button', { name: `Reorder ${before[0]}`, exact: true });
      await tabTo(page, reorderHandle);
      await page.keyboard.press('ArrowDown');

      await expect.poll(() => headerTexts(table)).toEqual([before[1], before[0], ...before.slice(2)]);
      await expect(reorderHandle, 'focus follows the moved column').toBeFocused();

      await tabTo(page, sidebar.getByRole('button', { name: 'Close column visibility panel' }), 'Shift+Tab');
      await page.keyboard.press('Enter');
      await expect(sidebar).toBeHidden();
      expect(await focusIsInTable(page), 'focus returns to the table when the sidebar closes').toBe(true);
    });

    test('cell actions menu is reachable from the keyboard', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      const cell = table
        .getByRole('gridcell')
        .filter({ has: page.getByTestId(tableNG(selectors).cellActions.triggerButton) })
        .first();
      const targetCol = Number(await cell.getAttribute('aria-colindex'));
      const targetRow = Number(await cell.evaluate((el) => el.closest('[role="row"]')?.getAttribute('aria-rowindex')));

      // Enter the grid body from the last header, then walk to the target cell with the arrow keys.
      const columns = await headerTexts(table);
      await tabToColumnMenu(page, selectors, columns.at(-1)!);
      await page.keyboard.press('Tab');
      await expect(focused(page)).toHaveAttribute('role', 'gridcell');
      for (let row = 2; row < targetRow; row++) {
        await page.keyboard.press('ArrowDown');
      }
      for (let col = 1; col < targetCol; col++) {
        await page.keyboard.press('ArrowRight');
      }
      await expect(focused(page)).toHaveAttribute('aria-colindex', String(targetCol));

      await page.keyboard.press('Tab');
      const focusedTrigger = focused(page);
      await expect(focusedTrigger).toHaveAttribute('data-testid', tableNG(selectors).cellActions.triggerButton);
      await expect(focusedTrigger).toBeVisible();

      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu', { name: 'Cell actions' });
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(focusedTrigger).toBeFocused();
    });

    test('focus can leave the table from the body without a mouse', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      const columns = await headerTexts(table);
      await tabToColumnMenu(page, selectors, columns.at(-1)!);
      await page.keyboard.press('Tab');
      await expect(focused(page)).toHaveAttribute('role', 'gridcell');

      // Shift+Tab walks back through the header and out of the grid.
      let presses = 0;
      while ((await focusIsInTable(page)) && presses < columns.length * 2 + 5) {
        await page.keyboard.press('Shift+Tab');
        presses++;
      }
      expect(await focusIsInTable(page), `focus left the table after ${presses} Shift+Tab presses`).toBe(false);
    });
  });

  test.describe('screen reader labels', () => {
    test('every column menu button is named after its column', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      const columns = await headerTexts(table);
      const names = await table
        .getByTestId(tableNG(selectors).headerColumnMenu.button)
        .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));

      expect(names).toEqual(columns.map((name) => `Column options for ${name}`));
    });

    test('sort state is announced on the column header', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      const header = table.getByRole('columnheader').nth(1);
      await expect(header).not.toHaveAttribute('aria-sort');
      await header.locator('button[title]').click();
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await header.locator('button[title]').click();
      await expect(header).toHaveAttribute('aria-sort', 'descending');
    });

    test('menus and the filter trigger expose their open state', async ({ page, selectors }) => {
      await gotoSoloTable(page, selectors);
      const menuButton = columnMenuButton(page, selectors, 'Info');
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await menuButton.click();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('menu', { name: 'Column options for Info' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('the columns sidebar is a named group with named controls', async ({ page, selectors }) => {
      const table = await gotoSoloTable(page, selectors);
      const columns = await headerTexts(table);
      await page.getByRole('button', { name: `Column options for ${columns[0]}`, exact: true }).click();
      await page.getByTestId(tableNG(selectors).headerColumnMenu.manageColumnsItem).click();

      const sidebar = page.getByRole('group', { name: 'Column visibility' });
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole('button', { name: 'Close column visibility panel' })).toBeVisible();
      const handleNames = await sidebar
        .getByRole('button', { name: /^Reorder / })
        .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
      expect(handleNames).toEqual(columns.map((name) => `Reorder ${name}`));

      await sidebar.getByRole('checkbox', { name: `Hide ${columns[1]}`, exact: true }).click({ force: true });
      await expect(sidebar.getByRole('checkbox', { name: `Show ${columns[1]}`, exact: true })).not.toBeChecked();
    });

    test(
      'a11y with header menu and sidebar open',
      { tag: ['@a11y'] },
      async ({ page, selectors, scanForA11yViolations }) => {
        const table = await gotoSoloTable(page, selectors);
        const columns = await headerTexts(table);
        await page.getByRole('button', { name: `Column options for ${columns[0]}`, exact: true }).click();
        await page.getByTestId(tableNG(selectors).headerColumnMenu.manageColumnsItem).click();
        await expect(page.getByTestId(tableNG(selectors).columnsSidebar.container)).toBeVisible();
        await page.getByRole('button', { name: `Column options for ${columns[1]}`, exact: true }).click();
        await expect(page.getByRole('menu')).toBeVisible();

        const report = await scanForA11yViolations({
          options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
        });
        expect(report).toHaveNoA11yViolations({ ignoredRules: ['page-has-heading-one', 'region', 'color-contrast'] });
      }
    );
  });
});

import { type Locator, type Page } from 'playwright-core';

import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = '16f11TZWk';

test.use({
  viewport: { width: 1920, height: 1080 },
  openFeature: {
    flags: {
      'flameGraph.tableNg': true,
      'table.refresh': true,
      'table.autoColumnWidths': true,
    },
  },
});

function header(grid: Locator, name: string) {
  return grid.getByRole('columnheader').getByRole('button', { name, exact: true });
}

function cell(grid: Locator, rowIdx: number, colIdx: number) {
  return grid.getByRole('row').nth(rowIdx).getByRole('gridcell').nth(colIdx);
}

async function expectTopTable(page: Page) {
  const grid = page.locator('.rdg:not([aria-hidden="true"])');
  await expect(grid).toHaveCount(1);
  for (const name of ['Symbol', 'Self', 'Total']) {
    await expect(header(grid, name)).toBeVisible();
  }
  return grid;
}

test.describe('Panels test: Flame graph top table with TableNG', { tag: ['@panels', '@flamegraph'] }, () => {
  test('sorts by Self then Total, and clicking a symbol searches for it', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: new URLSearchParams({ viewPanel: 'panel-8' }) });
    const grid = await expectTopTable(page);

    // Default sort is Self descending.
    await expect(cell(grid, 1, 1)).toHaveText('net/http.HandlerFunc.ServeHTTP');
    await expect(cell(grid, 1, 2)).toHaveText('31.7 K');

    // First click sorts ascending, second descending.
    await header(grid, 'Total').click();
    await header(grid, 'Total').click();
    await expect(cell(grid, 1, 1)).toHaveText('total');
    await expect(cell(grid, 1, 3)).toHaveText('16.5 Bil');
    await expect(cell(grid, 2, 1)).toHaveText('runtime.systemstack');

    await cell(grid, 1, 1).getByRole('link').click();
    await expect(page.getByPlaceholder('Search...')).toHaveValue('^total$');
  });
});

import { type Page, type Locator } from '@playwright/test';

import { expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

export const getCell = (loc: Page | Locator, rowIdx: number, colIdx: number) =>
  loc
    .locator('> [role="row"]')
    .nth(rowIdx)
    .locator(rowIdx === 0 ? '> [role="columnheader"]' : '> [role="gridcell"]')
    .nth(colIdx);

export const getCellHeight = async (loc: Page | Locator, rowIdx: number, colIdx: number) => {
  const cell = getCell(loc, rowIdx, colIdx);
  return (await cell.boundingBox())?.height ?? 0;
};

export const getColumnIdx = async (loc: Page | Locator, columnName: string) => {
  // find the index of the column "Long text." The kitchen sink table will change over time, but
  // we can just find the column programatically and use it throughout the test.
  let result = -1;
  const colCount = await loc.getByRole('columnheader').count();
  for (let colIdx = 0; colIdx < colCount; colIdx++) {
    const cell = getCell(loc, 0, colIdx);
    if ((await cell.textContent()) === columnName) {
      result = colIdx;
      break;
    }
  }
  if (result === -1) {
    throw new Error(`Could not find the "${columnName}" column in the table`);
  }
  return result;
};

export const waitForTableLoad = async (loc: Page | Locator) => {
  await expect(loc.locator('.rdg:not([aria-hidden="true"])').first()).toBeVisible();
};

export const getRangeFilterValueCount = async (
  filterContainer: Locator,
  selectors: E2ESelectorGroups
): Promise<number> => {
  const histogram = filterContainer.getByTestId(
    selectors.components.Panels.Visualization.TableNG.Filters.Range.histogram
  );
  await expect(histogram).toBeVisible();
  const label = await histogram.getAttribute('aria-label');
  const count = label?.match(/Value distribution, (\d+) finite values/)?.[1];
  if (count === undefined) {
    throw new Error(`Could not read numeric filter value count from histogram label: ${label}`);
  }
  return Number(count);
};

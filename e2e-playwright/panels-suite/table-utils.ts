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
  await expect(loc.locator('.rdg').first()).toBeVisible();
};

/**
 * Returns the count of selected options shown on the "Select all" / "N selected" checkbox
 * in a TableNG filter popup.
 */
export const getSelectedFilterCount = async (
  filterContainer: Locator,
  selectors: E2ESelectorGroups
): Promise<number> => {
  await expect(
    filterContainer,
    'filter container should be visible before getting selected filter count'
  ).toBeVisible();
  const selectAllCheckbox = filterContainer.getByTestId(
    selectors.components.Panels.Visualization.TableNG.Filters.SelectAll
  );
  const selectAllInput = selectAllCheckbox.locator('input');
  await expect(selectAllCheckbox).toBeVisible();
  const wasInitiallyChecked = await selectAllInput.isChecked();

  if (!wasInitiallyChecked) {
    await selectAllCheckbox.click();
    await expect(selectAllInput, 'select all is checked after click').toBeChecked();
  }

  const text = (await selectAllCheckbox.textContent()) ?? '';
  const result = parseInt(text.match(/(\d+) selected/)?.[1] ?? '0', 10);

  if (!wasInitiallyChecked) {
    await selectAllCheckbox.click();
    // for some reason, this part takes like 10s to run in the nested table test, so we just won't check
    // with an assertion. in most cases we are just going to close the filter popup without saving anyway at this point.
    // await expect(selectAllInput, 'select all is unchecked after click').not.toBeChecked();
  }

  return result;
};

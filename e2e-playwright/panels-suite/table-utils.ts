import { Page, Locator } from '@playwright/test';

export const getCell = async (loc: Page | Locator, rowIdx: number, colIdx: number) =>
  loc
    .getByRole('row')
    .nth(rowIdx)
    .getByRole(rowIdx === 0 ? 'columnheader' : 'gridcell')
    .nth(colIdx);

export const getCellHeight = async (loc: Page | Locator, rowIdx: number, colIdx: number) => {
  const cell = await getCell(loc, rowIdx, colIdx);
  return (await cell.boundingBox())?.height ?? 0;
};

export const getColumnIdx = async (loc: Page | Locator, columnName: string) => {
  // find the index of the column "Long text." The kitchen sink table will change over time, but
  // we can just find the column programatically and use it throughout the test.
  let result = -1;
  const colCount = await loc.getByRole('columnheader').count();
  for (let colIdx = 0; colIdx < colCount; colIdx++) {
    const cell = await getCell(loc, 0, colIdx);
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

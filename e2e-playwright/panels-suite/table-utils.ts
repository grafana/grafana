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

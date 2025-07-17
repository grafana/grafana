import { Page, Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

test.use({
  viewport: { width: 1600, height: 1080 },
  featureToggles: {
    tableNextGen: true,
  },
});

// helper utils
const getCell = async (loc: Page | Locator, rowIdx: number, colIdx: number) =>
  loc.getByRole('row').nth(rowIdx).getByRole('gridcell').nth(colIdx);

const getCellHeight = async (loc: Page | Locator, rowIdx: number, colIdx: number) => {
  const cell = await getCell(loc, rowIdx, colIdx);
  return (await cell.boundingBox())?.height ?? 0;
};

test.describe(
  'Panels test: Table - Kitchen Sink',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests word wrap, hover overflow, and cell inspect', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.locator('.rdg')).toBeVisible();

      // text wrapping is enabled by default on this panel.
      await expect(getCellHeight(page, 1, 5)).resolves.toBeGreaterThan(100);

      // toggle the lorem ipsum column's wrap text toggle and confirm that the height shrinks.
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Wrap text'))
        .last()
        .click();
      await expect(getCellHeight(page, 1, 5)).resolves.toBeLessThan(100);

      // test that hover overflow works.
      const loremIpsumCell = await getCell(page, 1, 5);
      await loremIpsumCell.hover();
      await expect(getCellHeight(page, 1, 5)).resolves.toBeGreaterThan(100);
      await (await getCell(page, 1, 6)).hover();
      await expect(getCellHeight(page, 1, 5)).resolves.toBeLessThan(100);

      // enable cell inspect, confirm that hover no longer triggers.
      await dashboardPage
        .getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Cell options Cell value inspect')
        )
        .first()
        .locator('label[for="custom.inspect"]')
        .click();
      await loremIpsumCell.hover();
      await expect(getCellHeight(page, 1, 5)).resolves.toBeLessThan(100);

      // click cell inspect, check that cell inspection pops open in the side as we'd expect.
      await loremIpsumCell.getByLabel('Inspect value').click();
      const loremIpsumText = await loremIpsumCell.textContent();
      expect(loremIpsumText).toBeDefined();
      await expect(page.getByRole('dialog').getByText(loremIpsumText!)).toBeVisible();
    });

    // test visibility, display name

    // test sort

    // test filter
  }
);

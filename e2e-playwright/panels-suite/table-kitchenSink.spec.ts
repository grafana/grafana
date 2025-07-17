import { test, expect } from '@grafana/plugin-e2e';

test.use({
  viewport: { width: 1600, height: 1080 },
  featureToggles: {
    tableNextGen: true,
  },
});

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

      // ---- Toggle text wrapping ----
      // check that row height is increased due to the the wrapped rows
      const getCell = async (rowIdx: number, colIdx: number) =>
        page.getByRole('row').nth(rowIdx).getByRole('gridcell').nth(colIdx);
      const getCellHeight = async (rowIdx: number, colIdx: number) => {
        const cell = await getCell(rowIdx, colIdx);
        return (await cell.boundingBox())?.height ?? 0;
      };

      await expect(getCellHeight(1, 5)).resolves.toBeGreaterThan(100);

      // toggle the lorem ipsum column's wrap text toggle.
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Wrap text'))
        .last()
        .click();

      await expect(getCellHeight(1, 5)).resolves.toBeLessThan(100);

      // now, test that hover overflow works.
      await (await getCell(1, 5)).hover();
      await expect(getCellHeight(1, 5)).resolves.toBeGreaterThan(100);
      await (await getCell(1, 6)).hover();
      await expect(getCellHeight(1, 5)).resolves.toBeLessThan(100);
    });

    // test visibility, display name

    // test sort

    // test filter
  }
);

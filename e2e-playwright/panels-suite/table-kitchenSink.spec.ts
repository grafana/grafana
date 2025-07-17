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

    test('Tests visibility and display name via overrides', async ({ gotoDashboardPage, selectors, page }) => {
      await gotoDashboardPage({
        uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.locator('.rdg')).toBeVisible();

      // confirm that "State" column is hidden by default.
      expect(page.getByRole('row').nth(0)).not.toContainText('State');

      // toggle the "State" column visibility and test that it appears before re-hiding it.
      // FIXME this selector is utterly godawful, but there's no way to give testIds or aria-labels or anything to
      // the panel editor builder. we should fix that to make e2e's easier to write for our team.
      const hideStateColumnSwitch = page.locator('[id="Override 12"]').locator('label').last();
      await hideStateColumnSwitch.click();
      await expect(page.getByRole('row').nth(0)).toContainText('State');

      // now change the display name of the "State" column.
      // FIXME it would be good to have a better selector here too.
      const displayNameInput = page.locator('[id="Override 12"]').locator('input[value="State"]').last();
      await displayNameInput.fill('State (renamed)');
      await displayNameInput.press('Enter');
      await expect(page.getByRole('row').nth(0)).toContainText('State (renamed)');
    });

    // we test niche cases for sorting, filtering, pagination, etc. in a unit tests already.
    // we mainly want to test the happiest paths for these in e2es as well to check for integration
    // issues, but the unit tests can confirm that the internal logic works as expected much more quickly and thoroughly.
    // hashtag testing pyramid.
    test('Tests sorting by column', async ({ gotoDashboardPage, selectors, page }) => {
      await gotoDashboardPage({
        uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.locator('.rdg')).toBeVisible();

      // click the "State" column header to sort it.
      const stateColumnHeader = page.getByRole('columnheader').filter({ hasText: 'Info' });
      await stateColumnHeader.click();
      await expect(stateColumnHeader).toHaveAttribute('aria-sort', 'ascending');
      expect(getCell(page, 1, 1)).resolves.toContainText('down'); // down or down fast

      await stateColumnHeader.click();
      await expect(stateColumnHeader).toHaveAttribute('aria-sort', 'descending');
      expect(getCell(page, 1, 1)).resolves.toContainText('up'); // up or up fast

      await stateColumnHeader.click();
      await expect(stateColumnHeader).not.toHaveAttribute('aria-sort');
    });

    test('Tests filtering within a column', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.locator('.rdg')).toBeVisible();

      const stateColumnHeader = page.getByRole('columnheader').filter({ hasText: 'Info' });

      // get the first value in the "State" column, filter it out, then check that it went away.
      const firstStateValue = (await (await getCell(page, 1, 1)).textContent())!;
      await stateColumnHeader
        .getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton)
        .click();
      const filterContainer = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Visualization.TableNG.Filters.Container
      );

      await expect(filterContainer).toBeVisible();

      // select all, then click the first value to unselect it, filtering it out.
      await filterContainer.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll).click();
      await filterContainer.getByTitle(firstStateValue, { exact: true }).locator('label').click();
      await filterContainer.getByRole('button', { name: 'Ok' }).click();

      // make sure the filter container closed when we clicked "Ok".
      await expect(filterContainer).not.toBeVisible();

      // did it actually filter out our value?
      await expect(getCell(page, 1, 1)).resolves.not.toHaveText(firstStateValue);
    });

    test('Tests pagination, row height adjustment', async ({ gotoDashboardPage, selectors, page }) => {
      const rowRe = /([\d]+) - ([\d]+) of ([\d]+) rows/;
      const getRowStatus = async (page: Page | Locator) => {
        const text = (await page.getByText(rowRe).textContent()) ?? '';
        const match = text.match(rowRe);
        return {
          start: parseInt(match?.[1] ?? '0', 10),
          end: parseInt(match?.[2] ?? '0', 10),
          total: parseInt(match?.[3] ?? '0', 10),
        };
      };

      const dashboardPage = await gotoDashboardPage({
        uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.locator('.rdg')).toBeVisible();

      await page
        .getByLabel(selectors.components.PanelEditor.OptionsPane.fieldLabel(`Enable pagination`), { exact: true })
        .click();

      // because of text wrapping, we're guaranteed to only be showing a single row when we enable pagination.
      await expect(page.getByText(/([\d]+) - ([\d]+) of ([\d]+) rows/)).toBeVisible();

      // disable text wrap and see the number of rows.
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Wrap text'))
        .last()
        .click();

      // any number of rows that is not "1" is allowed here, we don't want to police the exact number of rows that
      // are rendered since there are tons of factors which could effect this. we do want to grab this number for comparison
      // in a second, though.
      const smallRowStatus = await getRowStatus(page);
      expect(smallRowStatus.end).toBeGreaterThan(1);
      expect(page.locator('.rdg').getByRole('row')).toHaveCount(smallRowStatus.end + 1);

      // change cell height to Large
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Table Cell height'))
        .locator('input')
        .last()
        .click();
      const largeRowStatus = await getRowStatus(page);
      expect(largeRowStatus.end).toBeLessThan(smallRowStatus.end);
      await expect(page.locator('.rdg').getByRole('row')).toHaveCount(largeRowStatus.end + 1);

      // click a page over with the directional nav
      await page.getByLabel('next page').click();
      const nextPageStatus = await getRowStatus(page);
      expect(nextPageStatus.start).toBe(largeRowStatus.end + 1);
      expect(nextPageStatus.end).toBe(largeRowStatus.end * 2);
      expect(nextPageStatus.total).toBe(largeRowStatus.total);

      // click a page number
      await page
        .getByTestId('data-testid panel content')
        .getByRole('navigation')
        .getByText('4', { exact: true })
        .click();
      const fourthPageStatus = await getRowStatus(page);
      expect(fourthPageStatus.start).toBe(largeRowStatus.end * 3 + 1);
      expect(fourthPageStatus.end).toBe(largeRowStatus.end * 4);
      expect(fourthPageStatus.total).toBe(largeRowStatus.total);
    });

    // DataLinks and Actions, context menu, right click context menu for inspection

    test('Empty Table panel', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
        queryParams: new URLSearchParams({ editPanel: '2' }),
      });

      expect(page.getByText('No data')).toBeVisible();
      expect(page.locator('.rdg')).not.toBeVisible();
    });
  }
);

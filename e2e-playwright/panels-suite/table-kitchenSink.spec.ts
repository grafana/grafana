import { Page, Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';

test.use({ viewport: { width: 2000, height: 1080 }, featureToggles: { tableNextGen: true } });

// helper utils
const waitForTableLoad = async (loc: Page | Locator) => {
  await expect(loc.locator('.rdg')).toBeVisible();
};

const getCell = async (loc: Page | Locator, rowIdx: number, colIdx: number) =>
  loc
    .getByRole('row')
    .nth(rowIdx)
    .getByRole(rowIdx === 0 ? 'columnheader' : 'gridcell')
    .nth(colIdx);

const getCellHeight = async (loc: Page | Locator, rowIdx: number, colIdx: number) => {
  const cell = await getCell(loc, rowIdx, colIdx);
  return (await cell.boundingBox())?.height ?? 0;
};

const getColumnIdx = async (loc: Page | Locator, columnName: string) => {
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

test.describe('Panels test: Table - Kitchen Sink', { tag: ['@panels', '@table'] }, () => {
  test('Tests word wrap, hover overflow, and cell inspect', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).toBeVisible();

    // to avoid a race condition when counting up , wait for react-data-grid to finish rendering.
    await waitForTableLoad(page);

    const longTextColIdx = await getColumnIdx(page, 'Long Text');

    // text wrapping is enabled by default on this panel.
    await expect(getCellHeight(page, 1, longTextColIdx)).resolves.toBeGreaterThan(100);

    // FIXME very bad selector to get the correct "wrap text" toggle here.
    // toggle the lorem ipsum column's wrap text toggle and confirm that the height shrinks.
    await page
      .locator('[id="Override 13"]')
      .locator(`[aria-label="${selectors.components.PanelEditor.OptionsPane.fieldLabel('Wrap text')}"]`)
      .click();
    await expect(getCellHeight(page, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // test that hover overflow works.
    const loremIpsumCell = await getCell(page, 1, longTextColIdx);
    await loremIpsumCell.scrollIntoViewIfNeeded();
    await loremIpsumCell.hover();
    await expect(getCellHeight(page, 1, longTextColIdx)).resolves.toBeGreaterThan(100);
    await (await getCell(page, 1, longTextColIdx + 1)).hover();
    await expect(getCellHeight(page, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // enable cell inspect, confirm that hover no longer triggers.
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Cell options Cell value inspect'))
      .first()
      .locator('label[for="custom.inspect"]')
      .click();
    await loremIpsumCell.hover();
    await expect(getCellHeight(page, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // click cell inspect, check that cell inspection pops open in the side as we'd expect.
    await loremIpsumCell.getByLabel('Inspect value').click();
    const loremIpsumText = await loremIpsumCell.textContent();
    expect(loremIpsumText).toBeDefined();
    await expect(page.getByRole('dialog').getByText(loremIpsumText!)).toBeVisible();
  });

  test('Tests visibility and display name via overrides', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).toBeVisible();

    // confirm that "State" column is hidden by default.
    expect(page.getByRole('row').nth(0)).not.toContainText('State');

    // toggle the "State" column visibility and test that it appears before re-hiding it.
    // FIXME this selector is utterly godawful, but there's no way to give testIds or aria-labels or anything to
    // the panel editor builder. we should fix that to make e2e's easier to write for our team.
    const hideStateColumnSwitch = page.locator('[id="Override 12"]').locator('label').last();
    await hideStateColumnSwitch.click();
    expect(page.getByRole('row').nth(0)).toContainText('State');

    // now change the display name of the "State" column.
    // FIXME it would be good to have a better selector here too.
    const displayNameInput = page.locator('[id="Override 12"]').locator('input[value="State"]').last();
    await displayNameInput.fill('State (renamed)');
    await displayNameInput.press('Enter');
    expect(page.getByRole('row').nth(0)).toContainText('State (renamed)');
  });

  // we test niche cases for sorting, filtering, pagination, etc. in a unit tests already.
  // we mainly want to test the happiest paths for these in e2es as well to check for integration
  // issues, but the unit tests can confirm that the internal logic works as expected much more quickly and thoroughly.
  // hashtag testing pyramid.
  test('Tests sorting by column', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).toBeVisible();

    // click the "State" column header to sort it.
    const stateColumnHeader = await getCell(page, 0, 1);

    await stateColumnHeader.getByText('Info').click();
    await expect(stateColumnHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(getCell(page, 1, 1)).resolves.toContainText('down'); // down or down fast

    await stateColumnHeader.getByText('Info').click();
    await expect(stateColumnHeader).toHaveAttribute('aria-sort', 'descending');
    expect(getCell(page, 1, 1)).resolves.toContainText('up'); // up or up fast

    await stateColumnHeader.getByText('Info').click();
    await expect(stateColumnHeader).not.toHaveAttribute('aria-sort');
  });

  test('Tests filtering within a column', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).toBeVisible();

    await waitForTableLoad(page);

    const infoColumnIdx = await getColumnIdx(page, 'Info');

    const stateColumnHeader = page.getByRole('columnheader').nth(infoColumnIdx);

    // get the first value in the "State" column, filter it out, then check that it went away.
    const firstStateValue = (await (await getCell(page, 1, infoColumnIdx)).textContent())!;
    await stateColumnHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
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
    await expect(getCell(page, 1, infoColumnIdx)).resolves.not.toHaveText(firstStateValue);
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
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).toBeVisible();

    await page
      .getByLabel(selectors.components.PanelEditor.OptionsPane.fieldLabel(`Enable pagination`), { exact: true })
      .click();

    // because of text wrapping, we're guaranteed to only be showing a single row when we enable pagination.
    await expect(page.getByText(/([\d]+) - ([\d]+) of ([\d]+) rows/)).toBeVisible();

    // FIXME horrible selector for the "Wrap text" toggle for the "Long text" column.
    await page
      .locator('[id="Override 13"]')
      .locator(`[aria-label="${selectors.components.PanelEditor.OptionsPane.fieldLabel('Wrap text')}"]`)
      .click();

    // any number of rows that is not "1" is allowed here, we don't want to police the exact number of rows that
    // are rendered since there are tons of factors which could effect this. we do want to grab this number for comparison
    // in a second, though.
    const smallRowStatus = await getRowStatus(page);
    expect(smallRowStatus.end).toBeGreaterThan(1);
    expect(page.getByRole('grid').getByRole('row')).toHaveCount(smallRowStatus.end + 2); // +2 for header and footer rows

    // change cell height to Large
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Table Cell height'))
      .locator('input')
      .last()
      .click();
    const largeRowStatus = await getRowStatus(page);
    expect(largeRowStatus.end).toBeLessThan(smallRowStatus.end);
    expect(page.getByRole('grid').getByRole('row')).toHaveCount(largeRowStatus.end + 2); // +2 for header and footer rows

    // click a page over with the directional nav
    await page.getByLabel('next page').click();
    const nextPageStatus = await getRowStatus(page);
    expect(nextPageStatus.start).toBe(largeRowStatus.end + 1);
    expect(nextPageStatus.end).toBe(largeRowStatus.end * 2);
    expect(nextPageStatus.total).toBe(largeRowStatus.total);

    // click a page number
    await page.getByTestId('data-testid panel content').getByRole('navigation').getByText('4', { exact: true }).click();
    const fourthPageStatus = await getRowStatus(page);
    expect(fourthPageStatus.start).toBe(largeRowStatus.end * 3 + 1);
    expect(fourthPageStatus.end).toBe(largeRowStatus.end * 4);
    expect(fourthPageStatus.total).toBe(largeRowStatus.total);
  });

  test.skip('Tests DataLinks (single and multi) and actions', async ({ gotoDashboardPage, selectors, page }) => {
    const addDataLink = async (title: string, url: string) => {
      await dashboardPage
        .getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Data links and actions Data links')
        )
        .locator('button')
        .filter({ hasText: 'Add link' })
        .click();

      // DataLinks dialog has popped open - fill it in and add a global datalink.
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('dialog').locator('#link-title').fill(title);
      await page.getByRole('dialog').locator('#data-link-input [contenteditable="true"]').focus();
      await page.getByRole('dialog').locator('#data-link-input [contenteditable="true"]').fill(url);
      await page.getByRole('dialog').locator('#data-link-input [contenteditable="true"]').blur();
      await page.getByRole('dialog').locator('button[aria-disabled="false"]').filter({ hasText: 'Save' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    };

    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).toBeVisible();

    // disable text wrapping for this test to make it easier to click the links, the long lorem ipsum
    // can push the links off the screen.
    // FIXME very bad selector to get the correct "wrap text" toggle here.
    await page
      .locator('[id="Override 13"]')
      .locator(`[aria-label="${selectors.components.PanelEditor.OptionsPane.fieldLabel('Wrap text')}"]`)
      .click();

    const infoColumnIdx = await getColumnIdx(page, 'Info');
    const pillColIdx = await getColumnIdx(page, 'Pills');
    const dataLinkColIdx = await getColumnIdx(page, 'Data Link');

    // Info column has a single DataLink by default.
    const infoCell = await getCell(page, 1, infoColumnIdx);
    await expect(infoCell.locator('a')).toBeVisible();
    expect(infoCell.locator('a')).toHaveAttribute('href');
    expect(infoCell.locator('a')).not.toHaveAttribute('aria-haspopup');

    // now, add a DataLink to the whole table
    await addDataLink('Test link', 'https://grafana.com');

    // add a DataLink to the whole table, all cells will now have a single link.
    const colCount = await page.getByRole('row').nth(1).getByRole('gridcell').count();
    for (let colIdx = 0; colIdx < colCount; colIdx++) {
      // - pills column currently does not support DataLinks.
      // - we don't apply DataLinks to the DataLinks column itself, since they're rendered inside.
      if (colIdx === pillColIdx || colIdx === dataLinkColIdx) {
        continue;
      }

      const cell = await getCell(page, 1, colIdx);
      await expect(cell.locator('a')).toBeVisible();
      expect(cell.locator('a')).toHaveAttribute('href');
      expect(cell.locator('a')).not.toHaveAttribute('aria-haspopup', 'menu');
    }

    const headerContainer = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer);

    // add another data link. now we'll check that the multi-link popups work.
    await addDataLink('Another test link', 'https://grafana.com/foo');

    // loop thru the columns, click the links, observe that the tooltip appears, and close the tooltip.
    for (let colIdx = 0; colIdx < colCount; colIdx++) {
      const cell = await getCell(page, 1, colIdx);
      if (colIdx === infoColumnIdx) {
        // the Info column should still have its single link.
        expect(cell.locator('a')).not.toHaveAttribute('aria-haspopup', 'menu');
        continue;
      }

      // - pills column currently does not support DataLinks.
      // - we don't apply DataLinks to the DataLinks column itself, since they're rendered inside.
      if (colIdx === pillColIdx || colIdx === dataLinkColIdx) {
        continue;
      }

      await cell.locator('a').click({ force: true });
      await expect(page.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).toBeVisible();

      await headerContainer.click(); // convenient just to click the header to close the tooltip.
      await expect(page.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).not.toBeVisible();
    }

    // add an Action to the whole table and check that the action button is added to the tooltip.
    // TODO -- saving for another day.
  });

  test('Empty Table panel', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '3' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage)
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).not.toBeVisible();
  });
});

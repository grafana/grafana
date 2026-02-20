import { test, expect } from '@grafana/plugin-e2e';

import { getCell, waitForTableLoad, getColumnIdx, getCellHeight } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';

test.use({ viewport: { width: 2000, height: 4000 } });

test.describe('Panels test: Table - Nested', { tag: ['@panels', '@table'] }, () => {
  test('expand and collapse a nested table', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Nested tables'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(page.locator('[role="row"]')).toHaveCount(3); // header + 2 rows

    const firstRowExpander = dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first();

    await firstRowExpander.click();
    await expect(page.locator('[role="row"]')).not.toHaveCount(3); // more rows are present now, it is dynamic tho.

    await firstRowExpander.click();
    await expect(page.locator('[role="row"]')).toHaveCount(3); // back to original state
  });

  test('sorting in a nested table', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Nested tables'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(page.locator('[role="row"]')).toHaveCount(3); // header + 2 rows

    // click both expanders to expand the nested tables
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();

    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .last()
      .click();

    const firstNestedTable = page.locator('.rdg').nth(1);
    const secondNestedTable = page.locator('.rdg').nth(2);

    // click the "Info" column header to sort it.
    const infoColumHeaderFirst = getCell(firstNestedTable, 0, 1);
    const infoColumHeaderLast = getCell(secondNestedTable, 0, 1);

    await infoColumHeaderFirst.getByText('Info').click();

    await expect(infoColumHeaderFirst).toHaveAttribute('aria-sort', 'ascending');
    await expect(infoColumHeaderLast).toHaveAttribute('aria-sort', 'ascending');
    // text will be "up" or "down"
    await expect(getCell(firstNestedTable, 1, 1)).not.toContainText('fast');
    await expect(getCell(secondNestedTable, 1, 1)).not.toContainText('fast');

    await infoColumHeaderFirst.getByText('Info').click();

    await expect(infoColumHeaderFirst).toHaveAttribute('aria-sort', 'descending');
    await expect(infoColumHeaderLast).toHaveAttribute('aria-sort', 'descending');
    // text will be "up fast" or "down fast"
    await expect(getCell(firstNestedTable, 1, 1)).toContainText('fast');
    await expect(getCell(secondNestedTable, 1, 1)).toContainText('fast');
  });

  test('filtering in a nested table', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Nested tables'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(page.locator('[role="row"]')).toHaveCount(3); // header + 2 rows

    // click both expanders to expand the nested tables
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();

    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .last()
      .click();

    const firstNestedTable = page.locator('.rdg').nth(1);
    const secondNestedTable = page.locator('.rdg').nth(2);

    // grab the both of the nested table's row counts before filtering the first table.
    const firstTableRowCount = await firstNestedTable.locator('[role="row"]').count();
    const secondTableRowCount = await secondNestedTable.locator('[role="row"]').count();

    const infoColumnIdx = await getColumnIdx(firstNestedTable, 'Info');

    const infoColumnHeader = firstNestedTable.getByRole('columnheader').nth(infoColumnIdx);

    // get the first value in the "State" column, filter it out, then check that it went away.
    const firstStateValue = (await getCell(firstNestedTable, 1, infoColumnIdx).textContent())!;
    await infoColumnHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
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
    await expect(getCell(firstNestedTable, 1, infoColumnIdx)).not.toHaveText(firstStateValue);
    expect(await firstNestedTable.locator('[role="row"]').count()).toBeLessThan(firstTableRowCount);
    expect(await secondNestedTable.locator('[role="row"]').count()).toBe(secondTableRowCount);
  });

  test('Tests word wrap, hover overflow, max cell height, and cell inspect', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Kitchen Sink'))
    ).toBeVisible();

    // add a group to nested tables transformation to the panel and group by State.
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations'))).toBeVisible();
    await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
    await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();
    await dashboardPage
      .getByGrafanaSelector(selectors.components.TransformTab.newTransform('Group to nested tables'))
      .click();
    await dashboardPage
      .getByGrafanaSelector(selectors.components.TransformTab.transformationEditor('Group to nested tables'))
      .getByLabel('State')
      .click();
    await dashboardPage
      .getByGrafanaSelector(selectors.components.TransformTab.transformationEditor('Group to nested tables'))
      .getByLabel('State')
      .fill('Group by');
    await dashboardPage
      .getByGrafanaSelector(selectors.components.TransformTab.transformationEditor('Group to nested tables'))
      .getByLabel('State')
      .press('Enter');

    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();
    const firstNestedTable = page.locator('.rdg').nth(1);

    const longTextColIdx = await getColumnIdx(firstNestedTable, 'Long Text');

    // text wrapping is enabled by default on this panel.
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeGreaterThan(100);

    // set a max row height, watch the height decrease, then clear it to continue.
    const maxRowHeightInput = page.getByLabel('Max row height').last();
    await maxRowHeightInput.fill('80');
    await expect(async () => {
      await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeLessThan(100);
    }).toPass();
    await maxRowHeightInput.clear();

    // toggle the lorem ipsum column's wrap text toggle and confirm that the height shrinks.
    await dashboardPage
      .getByGrafanaSelector(selectors.components.OptionsGroup.group('panel-options-override-12'))
      .getByLabel('Wrap text')
      .click({ force: true });
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // test that hover overflow works.
    const loremIpsumCell = getCell(firstNestedTable, 1, longTextColIdx);
    await loremIpsumCell.scrollIntoViewIfNeeded();
    await loremIpsumCell.hover();
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeGreaterThan(100);
    await getCell(firstNestedTable, 1, longTextColIdx + 1).hover();
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // enable cell inspect, confirm that hover no longer triggers.
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Cell options Cell value inspect'))
      .first()
      .getByRole('switch', { name: 'Cell value inspect' })
      .click({ force: true });
    await loremIpsumCell.hover();
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // click cell inspect, check that cell inspection pops open in the side as we'd expect.
    const loremIpsumText = await loremIpsumCell.textContent();
    expect(loremIpsumText).toBeDefined();
    await loremIpsumCell.getByLabel('Inspect value').click();
    await expect(page.getByRole('dialog').getByText(loremIpsumText!)).toBeVisible();
  });
});

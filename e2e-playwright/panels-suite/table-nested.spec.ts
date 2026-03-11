import { test, expect } from '@grafana/plugin-e2e';

import { getCell, waitForTableLoad, getColumnIdx, getCellHeight } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';
const NESTED_COMPLEX_DASHBOARD_UID = '1846eebb-eb2f-4d86-a17e-f0084118cdad';

test.use({ viewport: { width: 2000, height: 4000 } });

test.describe('Panels test: Table - Nested', { tag: ['@panels', '@table'] }, () => {
  test('a11y', { tag: ['@a11y'] }, async ({ gotoDashboardPage, scanForA11yViolations, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Nested tables'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(page.locator('[role="row"]').filter({ visible: true })).toHaveCount(3); // header + 2 rows

    const firstRowExpander = dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first();

    await firstRowExpander.click();
    await expect(page.locator('[role="row"]').filter({ visible: true })).not.toHaveCount(3);

    const report = await scanForA11yViolations({
      options: {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    });
    expect(report).toHaveNoA11yViolations({
      ignoredRules: ['page-has-heading-one', 'region'],
    });
  });

  test('expand and collapse', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Nested tables'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(page.locator('[role="row"]').filter({ visible: true })).toHaveCount(3); // header + 2 rows

    const firstRowExpander = dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first();

    await firstRowExpander.click();
    await expect(page.locator('[role="row"]')).not.toHaveCount(3); // more rows are present now, it is dynamic tho.

    await firstRowExpander.click();
    await expect(page.locator('[role="row"]')).toHaveCount(3); // back to original state
  });

  test('sorting', async ({ gotoDashboardPage, selectors, page }) => {
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

    const mainTable = page.locator('.rdg').nth(0);

    await expect(mainTable.locator('>[role="row"]')).toHaveCount(3);

    // click both expanders to expand the nested tables
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();

    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .last()
      .click();

    await expect(mainTable.locator('>[role="row"]')).toHaveCount(5);

    const firstNestedTable = page.locator('.rdg').nth(1);
    const secondNestedTable = page.locator('.rdg').nth(2);

    // grab the both of the nested table's row counts before filtering the first table.
    const firstTableRowCount = await firstNestedTable.locator('[role="row"]').count();
    const secondTableRowCount = await secondNestedTable.locator('[role="row"]').count();

    const stateColumnIdx = await getColumnIdx(mainTable, 'State');
    const infoColumnIdx = await getColumnIdx(firstNestedTable, 'Info');
    const lastStateValue = (await getCell(mainTable, 3, stateColumnIdx).textContent())!;

    const infoColumnHeader = firstNestedTable.getByRole('columnheader').nth(infoColumnIdx);

    // get the first value in the "Info" column, filter it out, then check that it went away.
    const firstInfoValue = (await getCell(firstNestedTable, 1, infoColumnIdx).textContent())!;
    await infoColumnHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const filterContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Filters.Container
    );

    await expect(filterContainer).toBeVisible();

    // select all, then click the first value to unselect it, filtering it out.
    await filterContainer.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll).click();
    await filterContainer.getByTitle(firstInfoValue, { exact: true }).locator('label').click();
    await filterContainer.getByRole('button', { name: 'Ok' }).click();

    // make sure the filter container closed when we clicked "Ok".
    await expect(filterContainer).not.toBeVisible();

    // did it actually filter out our value?
    await expect(getCell(firstNestedTable, 1, infoColumnIdx)).not.toHaveText(firstInfoValue);
    expect(await firstNestedTable.locator('[role="row"]').count()).toBeLessThan(firstTableRowCount);
    expect(await secondNestedTable.locator('[role="row"]').count()).toBe(secondTableRowCount);

    // confirm that filtering the main table works as expected.

    await expect(mainTable.locator('>[role="row"]')).toHaveCount(5); // header, top-level row + row containing nested table x2
    await expect(page.locator('.rdg')).toHaveCount(3); // main table + nested tables x2

    await mainTable
      .getByRole('columnheader')
      .nth(stateColumnIdx)
      .getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton)
      .click();
    await filterContainer.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll).click();
    await filterContainer.getByTitle(lastStateValue, { exact: true }).locator('label').click();
    await filterContainer.getByRole('button', { name: 'Ok' }).click();
    await expect(filterContainer).not.toBeVisible();

    await expect(getCell(mainTable, 1, stateColumnIdx)).not.toHaveText(lastStateValue);
    await expect(page.locator('.rdg')).toHaveCount(2);
  });

  test('word wrap, hover overflow, max cell height, and cell inspect', async ({
    gotoPanelEditPage,
    selectors,
    page,
  }) => {
    const panelEditPage = await gotoPanelEditPage({
      dashboard: {
        uid: NESTED_COMPLEX_DASHBOARD_UID,
      },
      id: '1',
    });

    await panelEditPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();
    const firstNestedTable = page.locator('.rdg').nth(1);

    const longTextColIdx = await getColumnIdx(firstNestedTable, 'Long Text');

    // text wrapping is enabled by default on this panel.
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeGreaterThanOrEqual(100);

    // set a max row height, watch the height decrease, then clear it to continue.
    const maxRowHeightInput = page.getByLabel('Max row height').last();
    await maxRowHeightInput.fill('80');
    await expect(async () => {
      await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeLessThan(100);
    }).toPass();
    await maxRowHeightInput.clear();

    // toggle the lorem ipsum column's wrap text toggle and confirm that the height shrinks.
    await panelEditPage
      .getByGrafanaSelector(selectors.components.OptionsGroup.group('panel-options-override-12'))
      .getByLabel('Wrap text')
      .click({ force: true });
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // test that hover overflow works.
    const loremIpsumCell = getCell(firstNestedTable, 1, longTextColIdx);
    await loremIpsumCell.scrollIntoViewIfNeeded();
    await loremIpsumCell.hover();
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeGreaterThanOrEqual(100);
    await getCell(firstNestedTable, 1, longTextColIdx + 1).hover();
    await expect(getCellHeight(firstNestedTable, 1, longTextColIdx)).resolves.toBeLessThan(100);

    // enable cell inspect, confirm that hover no longer triggers.
    await panelEditPage
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

  test('tooltip from field', async ({ gotoPanelEditPage, page, selectors }) => {
    const panelEditPage = await gotoPanelEditPage({
      dashboard: {
        uid: NESTED_COMPLEX_DASHBOARD_UID,
      },
      id: '1',
    });

    await panelEditPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();

    const firstCaret = panelEditPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Caret)
      .first();

    // test hovering over and blurring the caret, and whether the tooltip appears and disappears as expected.
    await firstCaret.hover();

    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)
    ).toBeVisible();

    await panelEditPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Nested Kitchen Sink'))
      .hover();

    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)
    ).not.toBeVisible();

    // when a pinned tooltip is open, clicking outside of it should close it.
    await firstCaret.click();

    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)
    ).toBeVisible();

    await panelEditPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Nested Kitchen Sink'))
      .click({ position: { x: 0, y: 0 } });

    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)
    ).not.toBeVisible();

    // when a pinned tooltip is open, clicking inside of it should NOT close it.
    await firstCaret.click();

    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)
    ).toBeVisible();

    const tooltip = panelEditPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper
    );
    await tooltip.click();

    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)
    ).toBeVisible();

    await panelEditPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.title('Table - Nested Kitchen Sink'))
      .click({ position: { x: 0, y: 0 } });

    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper)
    ).not.toBeVisible();
  });
});

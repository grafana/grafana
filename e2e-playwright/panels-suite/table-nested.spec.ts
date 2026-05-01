import { test, expect } from '@grafana/plugin-e2e';

import { getCell, waitForTableLoad, getColumnIdx, getCellHeight, getSelectedFilterCount } from './table-utils';

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

  test('cross-filter in nested table: second filter popup shows only values from filtered rows', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    test.slow();

    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Nested tables'))
    ).toBeVisible();

    await waitForTableLoad(page);

    // Expand both nested tables so we can interact with them
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

    const infoColumnIdx = await getColumnIdx(firstNestedTable, 'Info');
    const minColumnIdx = await getColumnIdx(firstNestedTable, 'Min');

    // --- Baseline: collect Min options from first nested table before any cross-filter ---
    const minHeader = firstNestedTable.getByRole('columnheader').nth(minColumnIdx);
    await minHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const filterContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Filters.Container
    );
    await minHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const allMinOptionCount = await getSelectedFilterCount(filterContainer, selectors);
    await filterContainer.getByRole('button', { name: 'Cancel' }).click();
    await expect(filterContainer).not.toBeVisible();

    // grab the value of the "Select all" checkbox to get the total count of Min options before filtering.
    const secondNestedInfoColumnIdx = await getColumnIdx(secondNestedTable, 'Info');
    const secondNestedMinColumnIdx = await getColumnIdx(secondNestedTable, 'Min');
    const secondMinHeader = secondNestedTable.getByRole('columnheader').nth(secondNestedMinColumnIdx);
    await secondMinHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const secondNestedMinOptionCountBefore = await getSelectedFilterCount(filterContainer, selectors);

    // sort the info column descending to ensure the "down fast" value is first
    const infoHeader = firstNestedTable.getByRole('columnheader').nth(infoColumnIdx);
    await infoHeader.getByText('Info').click({ modifiers: ['ControlOrMeta'] });
    await infoHeader.getByText('Info').click({ modifiers: ['ControlOrMeta'] });
    const firstInfoCell = getCell(firstNestedTable, 1, infoColumnIdx);
    await expect(
      firstInfoCell,
      'first info cell has "down fast" after adding Info column descending sort to first nested table with two clicks'
    ).toContainText('down fast');

    // --- Apply Info=down filter on the first nested table ---
    const infoColumnHeader = firstNestedTable.getByRole('columnheader').nth(infoColumnIdx);
    await infoColumnHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    await expect(filterContainer, 'filter container is visible after clicking info column header').toBeVisible();

    // select only "down"
    await filterContainer.getByTitle('down', { exact: true }).locator('label').click();
    await filterContainer.getByRole('button', { name: 'Ok' }).click();
    await expect(filterContainer, 'filter container is closed after applying filter').not.toBeVisible();

    // Verify the nested table rows are filtered
    await expect(firstInfoCell, 'first info cell is filtered after applying Info=down filter').not.toHaveText(
      'down fast'
    );

    // --- Open Min filter popup: cross-filter should restrict options ---
    await minHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    await expect(filterContainer, 'filter container is visible after clicking min column header').toBeVisible();

    await filterContainer.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll).click();
    const crossFilteredMinOptionCount = await getSelectedFilterCount(filterContainer, selectors);

    // With Info filtered to "up", Min options must be a subset of the unfiltered set
    expect(
      crossFilteredMinOptionCount,
      'cross-filtered min option count is less than all min option count'
    ).toBeLessThanOrEqual(allMinOptionCount);

    await filterContainer.getByRole('button', { name: 'Cancel' }).click();
    await expect(filterContainer, 'filter container is closed after clicking cancel').not.toBeVisible();

    // --- Verify filter is scoped to the first nested table only ---
    // The second nested table should be unaffected by the first nested table's filter.
    await secondMinHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const secondNestedMinOptionCountAfter = await getSelectedFilterCount(filterContainer, selectors);

    // Second nested table sees its own full set of Min options (not restricted by first table's filter)
    expect(secondNestedMinOptionCountBefore, 'second nested table min option count has not changed').toBe(
      secondNestedMinOptionCountAfter
    );

    await filterContainer.getByRole('button', { name: 'Cancel' }).click();
    // Verify second nested table still shows all Info values (not filtered)
    const secondNestedRowCount = await secondNestedTable.locator('[role="row"]').count();
    expect(
      secondNestedRowCount,
      'second nested table still has rows after first nested table applied filters'
    ).toBeGreaterThan(1); // header + at least one row

    // Cross-check: second nested table should show both "up" and non-"up" rows
    const secondTableInfoValues = new Set<string>();
    for (let i = 1; i < secondNestedRowCount; i++) {
      const text = await getCell(secondNestedTable, i, secondNestedInfoColumnIdx).textContent();
      if (text) {
        secondTableInfoValues.add(text.trim());
      }
    }
    // The second table should have rows that are not "up" (since its filter is not restricted)
    expect(secondTableInfoValues.size, 'second nested table should show both "up" and "up fast" rows').toBe(2);
  });

  test('word wrap, hover overflow, max cell height, and cell inspect', async ({
    gotoPanelEditPage,
    selectors,
    page,
  }) => {
    // This test performs many UI interactions on a nested table (which renders slower than a flat one).
    // The default timeout is not enough for CI.
    test.slow();
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
    await loremIpsumCell.hover(); // ensure the cell actions are visible before clicking
    await loremIpsumCell.getByLabel('Inspect value').click();
    await expect(page.getByRole('dialog').getByText(loremIpsumText!)).toBeVisible();
  });

  test('renamed field appears as column in nested table', async ({ gotoPanelEditPage, selectors, page }) => {
    // Regression test: a field renamed via Organize Fields before a Group to Nested Tables
    // transform must retain its display name as the nested table column header.
    // The field "A" is renamed to "Gauge" via the organize transform, then grouped into
    // nested tables. The nested table column header must read "Gauge", not "A".
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
    await expect(firstNestedTable.getByRole('columnheader', { name: 'Gauge' })).toBeVisible();
  });

  test('datalinks resolve field variables in nested table context', async ({ gotoDashboardPage, selectors, page }) => {
    // --- Part 1: Info column "Google this term" link interpolates ${__value:percentencode} ---
    // Panel 4 groups by State; Info is a nested field with 1 link + 1 action (→ tooltip on click).
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Nested tables'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .last()
      .click();

    const firstNestedTableKs = page.locator('.rdg').nth(1);
    const infoIdx = await getColumnIdx(firstNestedTableKs, 'Info');
    const infoCell = getCell(firstNestedTableKs, 1, infoIdx);
    const infoCellValue = (await infoCell.textContent())?.trim() ?? '';
    expect(infoCellValue, 'Info cell has a non-empty value').not.toBe('');

    // 1 link + 1 action renders as <a aria-haspopup="menu"> — click to open the tooltip.
    await infoCell.locator('a[aria-haspopup]').click();

    const tooltip = page.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper);
    await expect(tooltip, 'data link tooltip appears after clicking Info cell').toBeVisible();

    const googleHref = await tooltip.getByRole('link', { name: 'Google this term' }).getAttribute('href');
    expect(googleHref, '"Google this term" href contains the Info cell value').toContain(
      `q=${encodeURIComponent(infoCellValue)}`
    );

    // --- Part 2: Data Link column resolves ${__data.fields.Min.numeric} from nested row context ---
    // The "Table - Nested Kitchen Sink" panel groups by Info; nested rows have a "Data Link" column
    // with a "Min param" link whose URL contains ${__data.fields.Min.numeric}.
    const nestedDashboardPage = await gotoDashboardPage({
      uid: NESTED_COMPLEX_DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await waitForTableLoad(page);

    await nestedDashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.RowExpander)
      .first()
      .click();

    const firstNestedTable = page.locator('.rdg').nth(1);
    const dataLinkIdx = await getColumnIdx(firstNestedTable, 'Data Link');

    // The "Min param" link is rendered directly in the DataLinksCell as an <a> tag.
    const minParamLink = getCell(firstNestedTable, 1, dataLinkIdx).getByRole('link', { name: 'Min param' });
    const minParamHref = await minParamLink.getAttribute('href');

    expect(minParamHref, '"Min param" href is not null').not.toBeNull();
    expect(minParamHref, '"Min param" href does not contain unresolved template variable').not.toContain('${');
    expect(minParamHref, '"Min param" href contains min= with a numeric value').toMatch(/min=[\d.]+/);
  });

  test('expand nested rows by default', async ({ gotoPanelEditPage, selectors, page }) => {
    const panelEditPage = await gotoPanelEditPage({
      dashboard: {
        uid: NESTED_COMPLEX_DASHBOARD_UID,
      },
      id: '2',
    });

    await waitForTableLoad(page);

    // With expandedOnLoad: true the expander buttons should report aria-expanded=true
    // and nested rows should be visible without any user interaction.
    const expanders = panelEditPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.RowExpander
    );

    await expect(expanders.first()).toBeVisible();

    // Every expander should be in the expanded state — no user clicks required.
    const expanderCount = await expanders.count();
    expect(expanderCount, 'at least one row expander is present').toBeGreaterThan(0);

    for (let i = 0; i < expanderCount; i++) {
      await expect(expanders.nth(i)).toHaveAttribute('aria-expanded', 'true');
    }

    // The nested table is visible immediately — a second .rdg grid should exist.
    await expect(page.locator('.rdg').nth(1)).toBeVisible();
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

import { test, expect } from '@grafana/plugin-e2e';

import { getCell, getColumnIdx, getRangeFilterValueCount, waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 2000, height: 4000 },
});

test.describe('Panels test: Table - Nested', { tag: ['@panels', '@table'] }, () => {
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

    const firstNestedTable = page.locator('.rdg:not([aria-hidden="true"])').nth(1);
    const secondNestedTable = page.locator('.rdg:not([aria-hidden="true"])').nth(2);

    const infoColumnIdx = await getColumnIdx(firstNestedTable, 'Info');
    const minColumnIdx = await getColumnIdx(firstNestedTable, 'Min');

    // --- Baseline: count Min values in first nested table before cross-filtering ---
    const minHeader = firstNestedTable.getByRole('columnheader').nth(minColumnIdx);
    await minHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button).click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem).click();
    const filterContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Filters.Container
    );
    const allMinValueCount = await getRangeFilterValueCount(filterContainer, selectors);
    await filterContainer.getByRole('button', { name: 'Cancel' }).click();
    await expect(filterContainer).not.toBeVisible();

    // Count Min values in second nested table before filtering first table.
    const secondNestedInfoColumnIdx = await getColumnIdx(secondNestedTable, 'Info');
    const secondNestedMinColumnIdx = await getColumnIdx(secondNestedTable, 'Min');
    const secondMinHeader = secondNestedTable.getByRole('columnheader').nth(secondNestedMinColumnIdx);
    await secondMinHeader
      .getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button)
      .click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem).click();
    const secondNestedMinValueCountBefore = await getRangeFilterValueCount(filterContainer, selectors);

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
    await infoColumnHeader
      .getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button)
      .click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem).click();
    await expect(filterContainer, 'filter container is visible after clicking info column header').toBeVisible();

    // select only "down"
    await filterContainer.getByTitle('down', { exact: true }).locator('label').click();
    await filterContainer.getByRole('button', { name: 'Apply' }).click();
    await expect(filterContainer, 'filter container is closed after applying filter').not.toBeVisible();

    // Verify the nested table rows are filtered
    await expect(firstInfoCell, 'first info cell is filtered after applying Info=down filter').not.toHaveText(
      'down fast'
    );

    // --- Open Min filter popup: cross-filter should restrict values ---
    await minHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button).click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem).click();
    await expect(filterContainer, 'filter container is visible after clicking min column header').toBeVisible();

    const crossFilteredMinValueCount = await getRangeFilterValueCount(filterContainer, selectors);

    // With Info filtered to "down", Min values must be a subset of the unfiltered set.
    expect(
      crossFilteredMinValueCount,
      'cross-filtered Min value count is no greater than all Min value count'
    ).toBeLessThanOrEqual(allMinValueCount);

    await filterContainer.getByRole('button', { name: 'Cancel' }).click();
    await expect(filterContainer, 'filter container is closed after clicking cancel').not.toBeVisible();

    // --- Verify filter is scoped to the first nested table only ---
    // The second nested table should be unaffected by the first nested table's filter.
    await secondMinHeader
      .getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button)
      .click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem).click();
    const secondNestedMinValueCountAfter = await getRangeFilterValueCount(filterContainer, selectors);

    // Second nested table keeps its full set of Min values.
    expect(secondNestedMinValueCountBefore, 'second nested table Min value count has not changed').toBe(
      secondNestedMinValueCountAfter
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
});

import { test, expect } from '@grafana/plugin-e2e';

import { getCell, getColumnIdx, getRangeFilterValueCount, waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 2000, height: 1080 },
});

test.describe('Panels test: Table - Kitchen Sink', { tag: ['@panels', '@table'] }, () => {
  test('Cross-filter: second filter popup only shows values reachable after first filter', async ({
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

    await waitForTableLoad(page);

    const table = page.locator('.rdg:not([aria-hidden="true"])');

    const infoColumnIdx = await getColumnIdx(table, 'Info');
    const minColumnIdx = await getColumnIdx(table, 'Min');

    // --- Baseline: count finite Min values before cross-filtering ---
    const minHeader = page.getByRole('columnheader').nth(minColumnIdx);
    await minHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const minFilterContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Filters.Container
    );
    await expect(minFilterContainer, 'filter popup for min is visible after click').toBeVisible();

    const allMinValueCount = await getRangeFilterValueCount(minFilterContainer, selectors);

    // Close without applying
    await minFilterContainer.getByRole('button', { name: 'Cancel' }).click();
    await expect(minFilterContainer, 'filter popup for min is not visible after close').not.toBeVisible();

    // --- Sort by Info and confirm that the first value is not "up" to compare later in the test ---
    const infoHeader = page.getByRole('columnheader').nth(infoColumnIdx);
    await infoHeader.getByText('Info').click();
    await expect(infoHeader, 'info column header is sorted ascending after click').toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    const firstInfoCell = getCell(table, 1, infoColumnIdx);
    expect(firstInfoCell, 'first info cell is not "up" after sorting').not.toHaveText('up');

    // --- Apply a filter on Info to only show "up" rows ---
    await infoHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const infoFilterContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Filters.Container
    );
    await expect(infoFilterContainer, 'filter popup for info is visible after click').toBeVisible();
    await infoFilterContainer.getByTitle('up', { exact: true }).locator('label').click();
    await infoFilterContainer.getByRole('button', { name: 'Ok' }).click();
    await expect(infoFilterContainer).not.toBeVisible();

    // Table should now show only "up" rows
    await expect(firstInfoCell, 'first info cell is "up" after filtering').toHaveText('up');

    // --- Open the Min filter popup again; cross-filter should restrict its values ---
    await minHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    await expect(minFilterContainer, 'filter popup for min is visible after click').toBeVisible();

    const crossFilteredMinValueCount = await getRangeFilterValueCount(minFilterContainer, selectors);

    // With Info filtered to "up" only, fewer Min values remain.
    expect(crossFilteredMinValueCount, 'cross-filtered Min value count is less than all Min value count').toBeLessThan(
      allMinValueCount
    );

    // Close the filter popup
    await minFilterContainer.getByRole('button', { name: 'Cancel' }).click();
  });
});

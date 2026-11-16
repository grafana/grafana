import { test, expect } from '@grafana/plugin-e2e';

import { getColumnIdx, waitForTableLoad } from './table-utils';

const DASHBOARD_UID = '8100236d-603c-421e-a21b-2a0b0ea4eaa3';

test.use({ openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': false } } });

test.describe('Table footer with range filters disabled', { tag: ['@panels', '@table'] }, () => {
  test('Footer affected by value-list filtering', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Global footer, last not null'))
    ).toBeVisible();
    await waitForTableLoad(page);
    const table = page.locator('.rdg:not([aria-hidden="true"])');
    const columnIndex = await getColumnIdx(table, 'Min');
    const footer = dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
      .nth(columnIndex);
    const previousValue = await footer.innerText();
    await page
      .getByRole('columnheader')
      .nth(columnIndex)
      .getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button)
      .click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem).click();
    const popup = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Filters.Container
    );
    const selectAll = popup.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll);
    await selectAll.getByText('Select all', { exact: true }).click();
    await expect(selectAll.getByRole('checkbox')).toBeChecked();
    await popup.getByPlaceholder('Filter values').fill(previousValue);
    await popup.getByRole('checkbox', { name: previousValue, exact: true }).uncheck();
    await popup.getByRole('button', { name: 'Ok', exact: true }).click();
    await expect(footer).not.toHaveText(previousValue);
  });
});

import { Page, Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { getColumnIdx } from './table-utils';

const DASHBOARD_UID = '1ea31838-e4e8-4aa0-9333-1d4c3fa95641';

const waitForTableLoad = async (loc: Page | Locator) => {
  await expect(loc.locator('.rdg')).toBeVisible();
};

test.describe('Panels test: Table - Footer', { tag: ['@panels', '@table'] }, () => {
  test('Footer unaffected by filtering', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Global footer, last not null'))
    ).toBeVisible();

    await waitForTableLoad(page);

    const minColumnIdx = await getColumnIdx(page, 'Min');

    // this is the footer cell for the "Min" column.
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel)
        .nth(minColumnIdx)
    ).toHaveText('Last *');

    const minReducerValue = await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
      .nth(minColumnIdx)
      .innerText();

    const minColumnHeader = page.getByRole('columnheader').nth(minColumnIdx);

    // get the first value in the "State" column, filter it out, then check that it went away.
    await minColumnHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
    const filterContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Visualization.TableNG.Filters.Container
    );

    await expect(filterContainer).toBeVisible();

    // select all, then click the first value to unselect it, filtering it out.
    await filterContainer.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll).click();
    await filterContainer.getByTitle('Filter values').fill(minReducerValue);
    await filterContainer.getByTitle(minReducerValue, { exact: true }).locator('label').click();
    await filterContainer.getByRole('button', { name: 'Ok' }).click();

    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
        .nth(minColumnIdx)
    ).toHaveText(minReducerValue);
  });

  test('Footer unaffected by sorting', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Global footer, last not null'))
    ).toBeVisible();

    await waitForTableLoad(page);

    const minColumnIdx = await getColumnIdx(page, 'Min');

    // this is the footer cell for the "Min" column.
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel)
        .nth(minColumnIdx)
    ).toHaveText('Last *');

    const minReducerValue = await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
      .nth(minColumnIdx)
      .innerText();

    const minColumnHeader = page.getByRole('columnheader').nth(minColumnIdx);

    // get the first value in the "State" column, filter it out, then check that it went away.
    await minColumnHeader.getByText('Min').click();
    await expect(minColumnHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
        .nth(minColumnIdx)
    ).toHaveText(minReducerValue);

    await minColumnHeader.getByText('Min').click();
    await expect(minColumnHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
        .nth(minColumnIdx)
    ).toHaveText(minReducerValue);

    await minColumnHeader.getByText('Min').click();
    await expect(minColumnHeader).not.toHaveAttribute('aria-sort');
    await expect(
      dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
        .nth(minColumnIdx)
    ).toHaveText(minReducerValue);
  });

  test('Single-sum reducer label is hidden', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '6' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Single sum reducer'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel)
    ).not.toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
    ).toBeVisible();
  });

  test('Count rows for normal case', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '7' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Count rows'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel)
    ).toContainText('Count');
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
    ).toBeVisible();
  });

  test('Count rows with a few hidden columns', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '8' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Count rows, hide initial columns'))
    ).toBeVisible();

    await waitForTableLoad(page);

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel)
    ).toContainText('Count');
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
    ).toBeVisible();
  });
});

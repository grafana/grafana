import { Page, Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { getColumnIdx, waitForTableLoad } from './table-utils';

const DASHBOARD_UID = '8100236d-603c-421e-a21b-2a0b0ea4eaa3';

test.describe('Panels test: Table - Footer', { tag: ['@panels', '@table'] }, () => {
  test.describe('range filters', () => {
    test.use({ openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } } });

    test('Footer affected by filtering', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '4' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Global footer, last not null'))
      ).toBeVisible();

      await waitForTableLoad(page);

      const table = page.locator('.rdg:not([aria-hidden="true"])');

      const minColumnIdx = await getColumnIdx(table, 'Min');

      // this is the footer cell for the "Min" column.
      const minReducerValue = await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
        .nth(minColumnIdx)
        .innerText();

      const minColumnHeader = page.getByRole('columnheader').nth(minColumnIdx);

      // Exclude the current last Min value, then check that the footer changes.
      await minColumnHeader.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton).click();
      const filterContainer = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Visualization.TableNG.Filters.Container
      );

      await expect(filterContainer).toBeVisible();

      const minimumSlider = filterContainer.getByRole('slider', { name: 'Minimum' });
      const extentMin = Number(await minimumSlider.getAttribute('aria-valuemin'));
      const extentMax = Number(await minimumSlider.getAttribute('aria-valuemax'));
      const footerValue = Number(minReducerValue.replaceAll(',', ''));
      expect(Number.isFinite(footerValue)).toBe(true);
      expect(extentMax).toBeGreaterThan(extentMin);

      if (footerValue - extentMin <= extentMax - footerValue) {
        await filterContainer
          .getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.Range.minimumInput)
          .fill(String((footerValue + extentMax) / 2));
      } else {
        await filterContainer
          .getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.Range.maximumInput)
          .fill(String((footerValue + extentMin) / 2));
      }
      await filterContainer.getByRole('button', { name: 'Apply' }).click();

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Visualization.TableNG.Footer.Value)
          .nth(minColumnIdx)
      ).not.toHaveText(minReducerValue);
    });
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

    const table = page.locator('.rdg:not([aria-hidden="true"])');

    const minColumnIdx = await getColumnIdx(table, 'Min');

    // this is the footer cell for the "Min" column.
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

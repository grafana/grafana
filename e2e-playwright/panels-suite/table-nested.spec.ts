import { test, expect } from '@grafana/plugin-e2e';

import { getCell, waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'dcb9f5e9-8066-4397-889e-864b99555dbb';

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
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    });
    expect(report).toHaveNoA11yViolations({ ignoredRules: ['page-has-heading-one', 'region'] });
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
});

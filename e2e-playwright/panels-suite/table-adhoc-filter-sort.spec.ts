import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1600, height: 1200 },
});

test.describe('Panels test: Table - ad-hoc typed filters', { tag: ['@panels', '@table'] }, () => {
  test('previews a numeric range, keeps it across refresh and hiding, and clears it', async ({
    gotoDashboardPage,
    page,
    selectors,
  }) => {
    const dashboard = await gotoDashboardPage({
      uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
      queryParams: new URLSearchParams({ viewPanel: 'panel-5', timezone: 'America/New_York' }),
    });
    await dashboard.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboard.getByGrafanaSelector(selectors.components.Panels.Panel.title('Apply to row - gradient'));
    const table = selectors.components.Panels.Visualization.TableNG;
    const range = table.Filters.Range;
    await waitForTableLoad(panel);
    await expect(panel.getByRole('row')).toHaveCount(11);
    await panel.getByRole('button', { name: 'Column options for A' }).click();
    await page.getByTestId(table.headerColumnMenu.filterItem).click();
    await expect(page.getByTestId(range.histogram)).toBeVisible();
    await page.getByTestId(range.minimum).fill('90');
    await page.getByTestId(range.maximum).fill('91');
    await expect(page.getByRole('status')).toHaveText('4 of 10 rows match');
    await expect(panel.getByRole('row')).toHaveCount(11);
    await page.getByTestId(range.apply).click();
    await expect(panel.getByRole('row')).toHaveCount(5);
    // The raw-frame scenario refreshes in the browser without a datasource request.
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(panel.getByTestId(table.Filters.clearAll)).toHaveText('Clear filters (1)');
    await panel.getByRole('button', { name: 'Column options for A' }).click();
    await page.getByTestId(table.headerColumnMenu.hideItem).click();
    await expect(panel.getByRole('button', { name: 'Column options for A' })).toBeHidden();
    await expect(panel.getByRole('row')).toHaveCount(5);
    await panel.getByTestId(table.Filters.clearAll).click();
    await expect(panel.getByRole('row')).toHaveCount(11);
  });

  test(
    'supports keyboard range editing with an accessible popup',
    { tag: ['@a11y'] },
    async ({ gotoDashboardPage, page, selectors, scanForA11yViolations }) => {
      const dashboard = await gotoDashboardPage({
        uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
        queryParams: new URLSearchParams({ viewPanel: 'panel-5', timezone: 'America/New_York' }),
      });
      await dashboard.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
      const panel = dashboard.getByGrafanaSelector(selectors.components.Panels.Panel.title('Apply to row - gradient'));
      const table = selectors.components.Panels.Visualization.TableNG;
      await waitForTableLoad(panel);
      await panel.getByRole('button', { name: 'Column options for A' }).click();
      await page.getByTestId(table.headerColumnMenu.filterItem).click();
      await expect(page.getByTestId(table.Filters.Range.minimum)).toBeFocused();
      await page.getByRole('slider', { name: 'Minimum', exact: true }).press('ArrowRight');
      await expect(page.getByTestId(table.Filters.Range.minimum)).not.toHaveValue('');
      const report = await scanForA11yViolations({
        include: `[data-testid="${table.Filters.Container}"]`,
        options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      });
      expect(report.violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(panel.getByRole('button', { name: 'Column options for A' })).toBeFocused();
    }
  );
  test('applies absolute date bounds in the dashboard timezone', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboard = await gotoDashboardPage({
      uid: 'dcb9f5e9-8066-4397-889e-864b99555dbb',
      queryParams: new URLSearchParams({ viewPanel: 'panel-5', timezone: 'America/New_York' }),
    });
    await dashboard.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();
    const panel = dashboard.getByGrafanaSelector(selectors.components.Panels.Panel.title('Apply to row - gradient'));
    const table = selectors.components.Panels.Visualization.TableNG;
    await waitForTableLoad(panel);
    await panel.getByRole('button', { name: 'Column options for Time' }).click();
    await page.getByTestId(table.headerColumnMenu.filterItem).click();
    await expect(page.getByText('Timezone: America/New_York')).toBeVisible();
    await page.getByTestId(table.Filters.Range.minimum).fill('2025-08-07 11:00:00.000');
    await page.getByTestId(table.Filters.Range.maximum).fill('2025-08-07 12:30:00.000');
    await expect(page.getByRole('status')).toHaveText('3 of 10 rows match');
    await page.getByTestId(table.Filters.Range.apply).click();
    await expect(panel.getByRole('row')).toHaveCount(4);
  });
});

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
    const dashboard = await gotoDashboardPage({ uid: 'table-adhoc-filter-sort' });
    const panel = dashboard.getByGrafanaSelector(selectors.components.Panels.Panel.title('Latency distribution'));
    const table = selectors.components.Panels.Visualization.TableNG;
    const range = table.Filters.Range;
    await waitForTableLoad(panel);
    await expect(panel.getByText(/^\d+ - \d+ of 126 rows$/)).toBeVisible();
    await panel.getByRole('button', { name: 'Column options for duration' }).click();
    await page.getByTestId(table.headerColumnMenu.filterItem).click();
    await expect(page.getByTestId(range.histogram)).toBeVisible();
    await page.getByTestId(range.minimum).fill('50');
    await page.getByTestId(range.maximum).fill('200');
    await expect(page.getByRole('status')).toHaveText('60 of 126 rows match');
    await expect(panel.getByText(/^\d+ - \d+ of 126 rows$/)).toBeVisible();
    await page.getByTestId(range.apply).click();
    await expect(panel.getByText(/^\d+ - \d+ of 60 rows$/)).toBeVisible();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(panel.getByTestId(table.Filters.clearAll)).toHaveText('Clear filters (1)');
    await panel.getByRole('button', { name: 'Column options for duration' }).click();
    await page.getByTestId(table.headerColumnMenu.hideItem).click();
    await expect(panel.getByRole('button', { name: 'Column options for duration' })).toBeHidden();
    await expect(panel.getByText(/^\d+ - \d+ of 60 rows$/)).toBeVisible();
    await panel.getByTestId(table.Filters.clearAll).click();
    await expect(panel.getByText(/^\d+ - \d+ of 126 rows$/)).toBeVisible();
  });

  test(
    'supports keyboard range editing with an accessible popup',
    { tag: ['@a11y'] },
    async ({ gotoDashboardPage, page, selectors, scanForA11yViolations }) => {
      const dashboard = await gotoDashboardPage({ uid: 'table-adhoc-filter-sort' });
      const panel = dashboard.getByGrafanaSelector(selectors.components.Panels.Panel.title('Latency distribution'));
      const table = selectors.components.Panels.Visualization.TableNG;
      await waitForTableLoad(panel);
      await panel.getByRole('button', { name: 'Column options for duration' }).click();
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
      await expect(panel.getByRole('button', { name: 'Column options for duration' })).toBeFocused();
    }
  );
  test('applies absolute date bounds in the dashboard timezone', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboard = await gotoDashboardPage({ uid: 'table-adhoc-filter-sort' });
    const panel = dashboard.getByGrafanaSelector(selectors.components.Panels.Panel.title('Latency distribution'));
    const table = selectors.components.Panels.Visualization.TableNG;
    await waitForTableLoad(panel);
    await panel.getByRole('button', { name: 'Column options for observed_at' }).click();
    await page.getByTestId(table.headerColumnMenu.filterItem).click();
    await expect(page.getByText('Timezone: America/New_York')).toBeVisible();
    await page.getByTestId(table.Filters.Range.minimum).fill('2026-09-17T12:00');
    await page.getByTestId(table.Filters.Range.maximum).fill('2026-09-17T12:30');
    await expect(page.getByRole('status')).toHaveText('31 of 126 rows match');
    await page.getByTestId(table.Filters.Range.apply).click();
    await expect(panel.getByText(/^\d+ - \d+ of 31 rows$/)).toBeVisible();
  });
});

import { test, expect } from '@grafana/plugin-e2e';

test.use({ viewport: { width: 1280, height: 1080 }, featureToggles: { tableNextGen: true } });

test.describe('Panels test: Table - Sparkline', { tag: ['@panels', '@table'] }, () => {
  test('Tests sparkline tables are successfully rendered', async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({
      uid: 'd6373b49-1957-4f00-9218-ee2120d3ecd9',
      queryParams: new URLSearchParams({ editPanel: '2' }),
    });

    await expect(page.getByRole('grid')).toBeVisible();

    const uplotCount = await page.locator('.uplot').count();
    const rowCount = await page.getByRole('row').count();
    expect(uplotCount).toBe(rowCount - 1);
  });
});

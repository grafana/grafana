import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Dashboard search',
  {
    tag: ['@dashboards-search'],
  },
  () => {
    test.use({ viewport: { width: 1280, height: 1080 } });

    test.beforeEach(async ({ page, selectors }) => {
      await page.goto('/dashboards');
      await expect(page.getByTestId(selectors.pages.BrowseDashboards.table.row('gdev dashboards'))).toBeVisible();
    });

    test('Search - Dashboards list', async ({ page, selectors }) => {
      await toggleSearchView(page, selectors);
      await assertResultsCount(page, 24);
    });

    test('Search - Filter by search input', async ({ page, selectors }) => {
      await toggleSearchView(page, selectors);
      await assertResultsCount(page, 24);

      const searchInput = await page.getByTestId('input-wrapper');
      await searchInput.click();
      await page.keyboard.type('Datasource tests - MySQL');

      await assertResultsCount(page, 2);

      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('Datasource tests - MySQL (unittest)');

      await assertResultsCount(page, 1);

      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('- MySQL');

      await assertResultsCount(page, 2);
    });
  }
);

async function assertResultsCount(page, length) {
  const rowGroup = await page.getByRole('rowgroup');
  await expect(rowGroup).toHaveCount(1);

  const rows = await rowGroup.first().getByRole('row');
  await expect(rows).toHaveCount(length);
}

async function toggleSearchView(page, selectors) {
  const toggleButtons = await page.getByTestId(selectors.pages.Dashboards.toggleView);
  await expect(toggleButtons).toHaveCount(2);

  const listRadioButton = await toggleButtons.nth(1).locator('input');
  await expect(listRadioButton).toBeChecked({ checked: false });

  await listRadioButton.check();
  await expect(listRadioButton).toBeChecked({ checked: true });
}

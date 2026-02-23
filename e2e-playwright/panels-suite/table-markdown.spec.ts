import { test, expect } from '@grafana/plugin-e2e';

import { getCellHeight } from './table-utils';

test.use({
  viewport: { width: 1280, height: 1080 },
});

const MARKDOWN_DASHBOARD_UID = '2769f5d8-0094-4ac4-a4f0-f68f620339cc';

test.describe(
  'Panels test: Table - Markdown',
  {
    tag: ['@panels', '@table'],
  },
  () => {
    test('Tests Markdown tables are successfully rendered', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: MARKDOWN_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.getByRole('grid')).toBeVisible();
    });

    test('Tests dynamic height and max row height', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: MARKDOWN_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      // confirm that the second row of the table is tall due to the content in it
      await expect(getCellHeight(page, 2, 1)).resolves.toBeGreaterThan(100);

      // set the max row height to 80, watch the row shrink
      const maxRowHeightInput = page.getByLabel('Max row height').last();
      await maxRowHeightInput.fill('80');
      await expect(async () => {
        await expect(getCellHeight(page, 2, 1)).resolves.toBeLessThan(100);
      }).toPass();
    });
  }
);

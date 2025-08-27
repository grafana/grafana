import { test, expect } from '@grafana/plugin-e2e';

test.use({
  viewport: { width: 1280, height: 1080 },
});

test.describe(
  'Panels test: Table - Markdown',
  {
    tag: ['@panels', '@table'],
  },
  () => {
    test('Tests Markdown tables are successfully rendered', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: '2769f5d8-0094-4ac4-a4f0-f68f620339cc',
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.getByRole('grid')).toBeVisible();
    });
  }
);

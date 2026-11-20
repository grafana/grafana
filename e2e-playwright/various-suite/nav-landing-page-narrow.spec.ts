import { test, expect } from '@grafana/plugin-e2e';

test.use({
  viewport: { width: 320, height: 640 },
});

test.describe(
  'Nav landing page on a 320px wide screen',
  {
    tag: ['@various'],
  },
  () => {
    test('keeps each card within the card grid', async ({ page }) => {
      await page.goto('/apps');
      const grid = page.getByRole('main').locator('section');
      await expect(grid.getByRole('link', { name: 'Extensions test app' })).toBeVisible();

      const gridBox = (await grid.boundingBox())!;
      const cardBox = (await grid.locator(':scope > *').first().boundingBox())!;
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(gridBox.x + gridBox.width);
    });
  }
);

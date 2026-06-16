import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Swagger',
  {
    tag: ['@various'],
  },
  () => {
    test('should render the swagger page', async ({ page }) => {
      await page.goto('/swagger');
      await expect(page.getByText('Grafana HTTP API')).toBeVisible();
    });
  }
);

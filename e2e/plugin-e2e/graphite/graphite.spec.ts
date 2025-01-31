import { test, expect } from '@grafana/plugin-e2e';

test('Smoke test: decoupled frontend plugin loads', async ({ createDataSourceConfigPage, page }) => {
  await createDataSourceConfigPage({ type: 'graphite' });

  await expect(await page.getByText('Type: Graphite', { exact: true })).toBeVisible();
  await expect(await page.getByRole('heading', { name: 'HTTP', exact: true })).toBeVisible();
});

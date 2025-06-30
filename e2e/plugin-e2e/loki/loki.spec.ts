import { test, expect } from '@grafana/plugin-e2e';

test('Smoke test: decoupled frontend plugin loads', async ({ createDataSourceConfigPage, page }) => {
  await createDataSourceConfigPage({ type: 'loki' });

  await expect(await page.getByText('Type: Loki', { exact: true })).toBeVisible();
  await expect(await page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
});

import { test, expect } from '@grafana/plugin-e2e';

test('Smoke test: decoupled frontend plugin loads', async ({ createDataSourceConfigPage, page }) => {
  await createDataSourceConfigPage({ type: 'loki' });

  await expect(page.getByText('Type: Loki', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
});

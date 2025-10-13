import { test, expect } from '@grafana/plugin-e2e';

test('Smoke test: decoupled frontend plugin loads', async ({ createDataSourceConfigPage, page }) => {
  await createDataSourceConfigPage({ type: 'grafana-azure-monitor-datasource' });

  await expect(await page.getByText('Type: Azure Monitor', { exact: true })).toBeVisible();
  await expect(await page.getByRole('heading', { name: 'Authentication', exact: true })).toBeVisible();
});

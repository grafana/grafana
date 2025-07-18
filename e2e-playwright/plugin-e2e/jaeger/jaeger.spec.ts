import { test, expect } from '@grafana/plugin-e2e';

test(
  'Smoke test: plugin loads',
  {
    tag: '@plugins',
  },
  async ({ createDataSourceConfigPage, page }) => {
    await createDataSourceConfigPage({ type: 'jaeger' });

    await expect(await page.getByText('Type: Jaeger', { exact: true })).toBeVisible();
    await expect(await page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
  }
);

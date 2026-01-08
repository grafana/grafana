import { test, expect } from '@grafana/plugin-e2e';

test(
  'Smoke test: plugin loads',
  {
    tag: '@plugins',
  },
  async ({ createDataSourceConfigPage, page }) => {
    await createDataSourceConfigPage({ type: 'grafana-postgresql-datasource' });

    await expect(await page.getByText('Type: PostgreSQL', { exact: true })).toBeVisible();
    await expect(await page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
  }
);

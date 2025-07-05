import { test, expect } from '@grafana/plugin-e2e';

test(
  'Smoke test: decoupled frontend plugin loads',
  {
    tag: '@plugins',
  },
  async ({ createDataSourceConfigPage, page }) => {
    await createDataSourceConfigPage({ type: 'elasticsearch' });

    await expect(await page.getByText('Type: Elasticsearch', { exact: true })).toBeVisible();
    await expect(await page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
  }
);

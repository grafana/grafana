import { test, expect } from '@grafana/plugin-e2e';

test(
  'Smoke test: decoupled frontend plugin loads',
  {
    tag: '@plugins',
  },
  async ({ createDataSourceConfigPage, page }) => {
    await createDataSourceConfigPage({ type: 'opentsdb' });

    await expect(await page.getByText('Type: OpenTSDB', { exact: true })).toBeVisible();
    await expect(await page.getByRole('heading', { name: 'HTTP', exact: true })).toBeVisible();
  }
);

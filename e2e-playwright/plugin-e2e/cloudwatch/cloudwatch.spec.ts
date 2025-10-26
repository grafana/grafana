import { test, expect } from '@grafana/plugin-e2e';

test(
  'Smoke test: decoupled frontend plugin loads',
  {
    tag: '@plugins',
  },
  async ({ createDataSourceConfigPage, page }) => {
    await createDataSourceConfigPage({ type: 'cloudwatch' });

    await expect(await page.getByText('Type: CloudWatch', { exact: true })).toBeVisible();
    await expect(await page.getByRole('heading', { name: 'Connection Details', exact: true })).toBeVisible();
  }
);

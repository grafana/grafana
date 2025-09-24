import { test, expect } from '@grafana/plugin-e2e';

test(
  'Smoke test: decoupled frontend plugin loads',
  {
    tag: '@plugins',
  },
  async ({ createDataSourceConfigPage, page }) => {
    await createDataSourceConfigPage({ type: 'stackdriver' });

    await expect(await page.getByText('Type: Google Cloud Monitoring', { exact: true })).toBeVisible();
    await expect(await page.getByText('Google JWT File', { exact: true })).toBeVisible();
  }
);

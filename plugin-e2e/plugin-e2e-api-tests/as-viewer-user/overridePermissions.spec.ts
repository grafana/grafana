import { expect, test } from '@grafana/plugin-e2e';

// override project user only for tests in this file
test.use({ storageState: 'playwright/.auth/admin.json', user: { user: 'admin', password: 'admin' } });

test('should not redirect to start page when permissions to navigate to page is exist', async ({ page }) => {
  await page.goto('/datasources', { waitUntil: 'networkidle' });
  expect(await page.title()).toMatch(/Data sources.*/);
});

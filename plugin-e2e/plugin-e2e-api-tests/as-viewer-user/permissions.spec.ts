import { expect, test } from '@grafana/plugin-e2e';

test('should redirect to start page when permissions to navigate to page is missing', async ({ page }) => {
  await page.goto('/');
  const homePageTitle = await page.title();
  await page.goto('/datasources', { waitUntil: 'networkidle' });
  expect(await page.title()).toEqual(homePageTitle);
});

test('current user should have viewer role', async ({ page, request }) => {
  await page.goto('/');
  const response = await request.get('/api/user/orgs');
  await expect(response).toBeOK();
  await expect(await response.json()).toContainEqual(expect.objectContaining({ role: 'Viewer' }));
});

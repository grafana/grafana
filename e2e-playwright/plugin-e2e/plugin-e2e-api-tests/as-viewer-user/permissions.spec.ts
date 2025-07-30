import { expect, test } from '@grafana/plugin-e2e';

test.describe(
  'plugin-e2e-api-test viewer',
  {
    tag: ['@plugins'],
  },
  () => {
    test('should redirect to start page when permissions to navigate to page is missing', async ({ page }) => {
      await page.goto('/');
      const homePageURL = new URL(page.url());
      await page.goto('/datasources', { waitUntil: 'networkidle' });
      const redirectedPageURL = new URL(page.url());
      expect(homePageURL.pathname).toEqual(redirectedPageURL.pathname);
    });

    test('current user should have viewer role', async ({ page, request }) => {
      await page.goto('/');
      const response = await request.get('/api/user/orgs');
      await expect(response).toBeOK();
      await expect(await response.json()).toContainEqual(expect.objectContaining({ role: 'Viewer' }));
    });
  }
);

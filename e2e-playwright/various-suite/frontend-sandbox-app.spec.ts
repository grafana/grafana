import { test, expect } from '@grafana/plugin-e2e';

const APP_ID = 'sandbox-app-test';

test.describe(
  'Datasource sandbox',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.request.post(`/api/plugins/${APP_ID}/settings`, {
        data: {
          enabled: true,
        },
      });
    });

    test.describe('App Page', () => {
      test('Loads the app page with the sandbox div wrapper', async ({ page }) => {
        await page.goto(`/a/${APP_ID}`);

        const sandboxDiv = page.locator('div[data-plugin-sandbox="sandbox-app-test"]');
        await expect(sandboxDiv).toBeVisible();

        const appPage = page.getByTestId('sandbox-app-test-page-one');
        await expect(appPage).toBeVisible();
      });

      test('Loads the app configuration with the sandbox div wrapper', async ({ page }) => {
        await page.goto(`/plugins/${APP_ID}`);

        const sandboxDiv = page.locator('div[data-plugin-sandbox="sandbox-app-test"]');
        await expect(sandboxDiv).toBeVisible();

        const configPage = page.getByTestId('sandbox-app-test-config-page');
        await expect(configPage).toBeVisible();
      });
    });
  }
);

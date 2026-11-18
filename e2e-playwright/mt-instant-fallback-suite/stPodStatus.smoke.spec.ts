import { test, expect, type Page } from '@grafana/plugin-e2e';

const ALLOWLISTED_URL = '/dashboards';
const NON_ALLOWLISTED_URL_A = '/explore';
const NON_ALLOWLISTED_URL_B = '/alerting';

const LOADER_TESTID = 'page-fallback-loader';
const ERROR_CARD_TESTID = 'st-pod-error-card';

async function mockGatewayStatus(page: Page, status: 'active' | 'error' | 'captcha' | 'starting'): Promise<void> {
  await page.route('**/_/status', (route) =>
    route.fulfill({
      status: status === 'error' ? 500 : 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ status }),
    })
  );
}

test.use({
  openFeature: {
    flags: {
      'grafana.mtFallback': { allowList: [ALLOWLISTED_URL] },
    },
  },
});

test.describe(
  'MT-instant fallback: ST pod status gate',
  {
    tag: ['@mt-instant-fallback'],
  },
  () => {
    test('allowlisted route polls the gateway but renders without the full-page ST pod loading state', async ({
      page,
    }) => {
      let statusHits = 0;
      await page.route('**/_/status', (route) => {
        statusHits++;
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          body: JSON.stringify({ status: 'active' }),
        });
      });

      await page.goto(ALLOWLISTED_URL);

      await expect(page.getByRole('heading', { name: /dashboards/i }).first()).toBeVisible();
      await expect(page.getByTestId(LOADER_TESTID)).toHaveCount(0);
      await expect.poll(() => statusHits).toBeGreaterThan(0);
    });

    test('allowlisted route shows mega menu preparing indicators for non-allowlisted items while pod is warming', async ({
      page,
    }) => {
      await mockGatewayStatus(page, 'starting');

      await page.goto(ALLOWLISTED_URL);

      await test.step('allowlisted page renders without the full-page suspense fallback', async () => {
        await expect(page.getByRole('heading', { name: /dashboards/i }).first()).toBeVisible();
        await expect(page.getByTestId(LOADER_TESTID)).toHaveCount(0);
      });

      await test.step('non-allowlisted mega menu items show the preparing indicator', async () => {
        await expect(page.getByRole('img', { name: /^Preparing / }).first()).toBeVisible();
      });
    });

    test('non-allowlisted route surfaces the error state when the gateway reports error', async ({ page }) => {
      await mockGatewayStatus(page, 'error');

      await page.goto(NON_ALLOWLISTED_URL_A);

      await expect(page.getByTestId(ERROR_CARD_TESTID)).toBeVisible();
    });

    test('SPA navigation to another non-allowlisted route recovers when the gateway becomes ready', async ({
      page,
    }) => {
      await mockGatewayStatus(page, 'error');

      await page.goto(NON_ALLOWLISTED_URL_A);
      await expect(page.getByTestId(ERROR_CARD_TESTID)).toBeVisible();

      await mockGatewayStatus(page, 'active');

      await page.evaluate((nextUrl) => {
        window.history.pushState({}, '', nextUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, NON_ALLOWLISTED_URL_B);

      await expect(page).toHaveURL(new RegExp(`${NON_ALLOWLISTED_URL_B}$`));
      await expect(page.getByTestId(ERROR_CARD_TESTID)).toHaveCount(0);
      await expect(page.getByTestId(LOADER_TESTID)).toHaveCount(0);
    });

    test('captcha status triggers a top-level page reload', async ({ page }) => {
      let navigationCount = 0;
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          navigationCount++;
        }
      });

      await mockGatewayStatus(page, 'captcha');

      await page.goto(NON_ALLOWLISTED_URL_A, { waitUntil: 'commit' });
      const navCountAfterGoto = navigationCount;

      await expect.poll(() => navigationCount, { timeout: 15_000 }).toBeGreaterThan(navCountAfterGoto);

      await mockGatewayStatus(page, 'active');
      await page.waitForLoadState('load');
      await expect(page.getByTestId(LOADER_TESTID)).toHaveCount(0);
    });
  }
);

import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'canvas-icon-fix-test-v2';
const PANEL_TITLE = 'Various SVG icons';

test.describe('Canvas Panel - Icon Mappings', () => {
  test('should render field-based icons from value mappings correctly', async ({ gotoDashboardPage, page }) => {
    await test.step('Navigate to dashboard and wait for panel to load', async () => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await page.waitForSelector('svg', { timeout: 10000 });
    });

    await test.step('Verify value mapping text values are displayed', async () => {
      await expect(page.getByText('Success')).toBeVisible();
      await expect(page.getByText('Warning')).toBeVisible();
      await expect(page.getByText('Error')).toBeVisible();
    });

    await test.step('Verify SVG icons rendered for mapped values', async () => {
      const svgCount = await page.locator('svg').count();
      expect(svgCount).toBeGreaterThanOrEqual(3);
    });
  });

  test('should render fixed path icons correctly', async ({ gotoDashboardPage, page }) => {
    await test.step('Set up network interception for absolute URL icon', async () => {
      await page.route('https://grafana.com/static/assets/img/grafana_icon.svg', async (route) => {
        const dummySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="10" fill="purple"/>
          <text x="12" y="16" text-anchor="middle" fill="white" font-size="10">TEST</text>
        </svg>`;
        await route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: dummySvg,
        });
      });
    });

    await test.step('Navigate to dashboard and wait for SVGs to load', async () => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await page.waitForSelector('svg:not([aria-hidden="true"])', { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    });

    await test.step('Verify at least 5 visible SVG icons are rendered (3 mapped + 2 fixed)', async () => {
      const visibleSvgs = page.locator('svg:not([aria-hidden="true"])');
      const svgCount = await visibleSvgs.count();
      expect(svgCount).toBeGreaterThanOrEqual(5);
    });

    await test.step('Verify visible SVG icons have content', async () => {
      const visibleSvgs = page.locator('svg:not([aria-hidden="true"])');
      const count = await visibleSvgs.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const svg = visibleSvgs.nth(i);
        await expect(svg).toBeAttached();
        const svgContent = await svg.innerHTML();
        expect(svgContent.length).toBeGreaterThan(0);
      }
    });
  });

  test('should not make invalid requests for unmapped numeric values', async ({ gotoDashboardPage, page }) => {
    const failedRequests: string[] = [];

    await test.step('Set up network request monitoring', async () => {
      page.on('requestfailed', (request) => {
        const url = request.url();
        if (url.match(/\/build\/\d+$/)) {
          failedRequests.push(url);
        }
      });
    });

    await test.step('Navigate to dashboard and wait for loading', async () => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await page.waitForTimeout(2000);
    });

    await test.step('Verify no invalid numeric path requests were made', async () => {
      expect(failedRequests).toHaveLength(0);
    });
  });

  test('should display text values from value mappings correctly', async ({ gotoDashboardPage, page }) => {
    await test.step('Navigate to dashboard', async () => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
    });

    await test.step('Verify mapped text values are displayed', async () => {
      await expect(page.getByText('Success')).toBeVisible();
      await expect(page.getByText('Warning')).toBeVisible();
      await expect(page.getByText('Error')).toBeVisible();
      await expect(page.getByText('No mapping (14)')).toBeVisible();
    });
  });
});

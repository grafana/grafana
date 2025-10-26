import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    scenes: true,
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

const DASHBOARD_UID = 'ZqZnVvFZz';

test.describe(
  'Share internally',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Clear localStorage before each test
      await page.evaluate(() => {
        window.localStorage.removeItem('grafana.dashboard.link.shareConfiguration');
      });
    });

    test('Create a locked time range short link', async ({ page, gotoDashboardPage, selectors }) => {
      // Navigate to dashboard with specific time range
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ from: 'now-6h', to: 'now' }),
      });

      // Open share internally drawer
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();

      const createResponse = page.waitForResponse(
        (response) => response.url().includes('/api/short-urls') && response.request().method() === 'POST'
      );

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareInternally)
        .click();

      await expect(page).toHaveURL(/.*shareView=link.*/);

      // Check that the required elements exist
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareInternally.lockTimeRangeSwitch)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareInternally.shortenUrlSwitch)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareInternally.copyUrlButton)
      ).toBeVisible();

      // Check radio buttons
      const radioButtons = dashboardPage.getByGrafanaSelector(selectors.components.RadioButton.container);
      await expect(radioButtons).toHaveCount(3);

      // Check localStorage is initially null
      const initialConfig = await page.evaluate(() => {
        return window.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
      });
      expect(initialConfig).toBeNull();

      // Wait for the short URL creation
      const response = await createResponse;
      expect(response.status()).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.url).toContain('goto');
    });

    test('Create a relative time range short link', async ({ page, gotoDashboardPage, selectors }) => {
      // Navigate to dashboard with specific time range
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ from: 'now-6h', to: 'now' }),
      });

      // Open share internally drawer
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareInternally)
        .click();

      const updateResponse = page.waitForResponse(
        (response) => response.url().includes('/api/short-urls') && response.request().method() === 'POST'
      );

      // Toggle the lock time range switch
      const lockTimeRangeSwitch = dashboardPage.getByGrafanaSelector(
        selectors.pages.ShareDashboardDrawer.ShareInternally.lockTimeRangeSwitch
      );
      await expect(lockTimeRangeSwitch).toBeInViewport();
      await expect(async () => {
        await lockTimeRangeSwitch.uncheck({ force: true });
      }).toPass();

      await expect(async () => {
        // Check localStorage configuration
        const shareConfig = await page.evaluate(() => {
          const config = window.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
          return config ? JSON.parse(config) : null;
        });

        expect(shareConfig).not.toBeNull();
        expect(shareConfig.useAbsoluteTimeRange).toBe(false);
        expect(shareConfig.useShortUrl).toBe(true);
        expect(shareConfig.theme).toBe('current');
      }).toPass();

      // Wait for the API response
      const response = await updateResponse;
      expect(response.status()).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.url).toContain('goto');
    });

    test('Share button gets configured link', async ({ page, gotoDashboardPage, selectors }) => {
      // Navigate to dashboard with specific time range
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ from: 'now-6h', to: 'now' }),
      });

      // Open share internally drawer
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareInternally)
        .click();

      // Check localStorage is initially null
      const initialConfig = await page.evaluate(() => {
        return window.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
      });
      expect(initialConfig).toBeNull();

      // Configure the sharing options
      const lockTimeRangeSwitch = dashboardPage.getByGrafanaSelector(
        selectors.pages.ShareDashboardDrawer.ShareInternally.lockTimeRangeSwitch
      );
      await expect(lockTimeRangeSwitch).toBeInViewport();
      await expect(async () => {
        await lockTimeRangeSwitch.uncheck({ force: true });
      }).toPass();
      const shortenUrlSwitch = dashboardPage.getByGrafanaSelector(
        selectors.pages.ShareDashboardDrawer.ShareInternally.shortenUrlSwitch
      );
      await expect(shortenUrlSwitch).toBeInViewport();
      await expect(async () => {
        await shortenUrlSwitch.uncheck({ force: true });
      }).toPass();

      // Close the drawer
      await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.close).click();

      await expect(page).not.toHaveURL(/.*shareView=link.*/);

      await expect(async () => {
        // Check that localStorage has been updated with the configuration
        const finalConfig = await page.evaluate(() => {
          const config = window.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
          return config ? JSON.parse(config) : null;
        });

        expect(finalConfig).not.toBeNull();
        expect(finalConfig.useAbsoluteTimeRange).toBe(false);
        expect(finalConfig.useShortUrl).toBe(false);
        expect(finalConfig.theme).toBe('current');
      }).toPass();
    });
  }
);

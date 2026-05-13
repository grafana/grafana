import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Admin Labs feature toggles',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/labs');
      await page.evaluate(() => localStorage.removeItem('grafana.featureToggles'));
    });

    test('renders registry summary', async ({ page }) => {
      await expect(page.getByText(/Showing \d+ of \d+ registry flags/i)).toBeVisible();
      await expect(page.getByText(/General availability/i).first()).toBeVisible();
    });

    test('search filters flags', async ({ page }) => {
      await page.getByRole('searchbox', { name: /search flags/i }).fill('zzz_no_such_flag_xyz');
      await expect(page.getByText(/Showing 0 of \d+ registry flags/i)).toBeVisible();
    });

    test('toggle persists override to localStorage', async ({ page }) => {
      const toggle = page.getByRole('switch', { name: /panelTitleSearch/i });
      await expect(toggle).toBeVisible();
      await toggle.click();
      const raw = await page.evaluate(() => localStorage.getItem('grafana.featureToggles'));
      expect(raw).toMatch(/panelTitleSearch=(true|false)/);
    });

    test('reset clears local overrides', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('grafana.featureToggles', 'panelTitleSearch=true'));
      await page.reload();
      await page.getByRole('button', { name: /reset all local overrides/i }).click();
      await page.waitForLoadState('networkidle');
      const raw = await page.evaluate(() => localStorage.getItem('grafana.featureToggles'));
      expect(raw).toBeNull();
    });
  }
);

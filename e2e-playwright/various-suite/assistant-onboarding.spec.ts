import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    assistantStubNav: true,
  },
});

test.describe(
  'Assistant onboarding stub',
  {
    tag: ['@various'],
  },
  () => {
    test('renders the onboarding fallback at the plugin URL when the plugin is not installed', async ({ page }) => {
      await page.goto('/a/grafana-assistant-app');

      await expect(page.getByRole('heading', { name: 'Grafana Assistant', level: 1 })).toBeVisible();

      const installCta = page.getByRole('link', { name: /install grafana assistant/i });
      await expect(installCta).toBeVisible();
      await expect(installCta).toHaveAttribute('href', '/plugins/grafana-assistant-app');
    });

    test('exposes an Assistant entry in the main nav that points at the plugin URL', async ({ page, selectors }) => {
      await page.goto('/');

      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeVisible();

      const assistantEntry = navMenu.getByRole('link', { name: /^Assistant/ });
      await expect(assistantEntry).toBeVisible();
      await expect(assistantEntry).toHaveAttribute('href', '/a/grafana-assistant-app');
    });
  }
);

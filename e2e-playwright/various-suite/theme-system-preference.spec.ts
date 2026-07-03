import { test, expect } from '@grafana/plugin-e2e';

const USER = 'theme-system-pref-test';
const PASSWORD = 'theme-system-pref-test';

test.use({
  user: { user: USER, password: PASSWORD },
  storageState: { cookies: [], origins: [] },
});

test.describe(
  'System preference theme',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ createUser, page, selectors }) => {
      await createUser();
      await page.getByTestId(selectors.pages.Login.username).fill(USER);
      await page.getByTestId(selectors.pages.Login.password).fill(PASSWORD);
      await page.getByTestId(selectors.pages.Login.submit).click();
      await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();

      await page.request.patch('/api/user/preferences', { data: { theme: 'system' } });
    });

    test('applies dark theme when system prefers dark', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');

      await expect(page.locator('body')).toHaveClass(/theme-dark/);
      await expect(page.locator('body')).not.toHaveClass(/theme-light/);
    });

    test('applies light theme when system prefers light', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');

      await expect(page.locator('body')).toHaveClass(/theme-light/);
      await expect(page.locator('body')).not.toHaveClass(/theme-dark/);
    });

    test('defaults to dark when no system color scheme preference', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'no-preference' });
      await page.goto('/');

      await expect(page.locator('body')).toHaveClass(/theme-dark/);
      await expect(page.locator('body')).not.toHaveClass(/theme-light/);
    });

    test('follows system preference change at runtime without page reload', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');
      await expect(page.locator('body')).toHaveClass(/theme-dark/);

      await page.emulateMedia({ colorScheme: 'light' });
      await expect(page.locator('body')).toHaveClass(/theme-light/);
      await expect(page.locator('body')).not.toHaveClass(/theme-dark/);
    });
  }
);

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Sunrise theme',
  {
    tag: ['@various'],
  },
  () => {
    test('should switch to Sunrise theme and persist after reload', async ({ page, selectors }) => {
      await page.goto('/');

      // Wait for the page to load
      await page.getByTestId(selectors.components.Panels.Panel.title('Latest from the blog')).waitFor({
        state: 'visible',
      });

      // Navigate to profile preferences
      await page.goto('/profile');
      const preferencesSaveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
      await expect(preferencesSaveButton).toBeVisible();

      // Open the theme dropdown and select Sunrise
      const themeCombobox = page.locator('#shared-preferences-theme-select');
      await themeCombobox.click();
      await page.getByRole('option', { name: 'Sunrise' }).click();

      // Save preferences
      await preferencesSaveButton.click();

      // Wait for reload (onSubmitForm triggers window.location.reload())
      await page.waitForURL(/\/profile/);
      await page.waitForLoadState('networkidle');

      // Verify Sunrise is selected
      await expect(themeCombobox).toHaveValue('Sunrise');

      // Reload the page and verify theme persists
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Navigate to profile again to verify persisted theme
      await page.goto('/profile');
      const themeComboboxAfterReload = page.locator('#shared-preferences-theme-select');
      await expect(themeComboboxAfterReload).toHaveValue('Sunrise');
    });
  }
);

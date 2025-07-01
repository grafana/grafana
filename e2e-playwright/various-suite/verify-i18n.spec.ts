import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Verify i18n',
  {
    tag: ['@various'],
  },
  () => {
    const I18N_USER = 'i18n-test';
    const I18N_PASSWORD = 'i18n-test';
    let userId: string;

    // Create a new user to isolate the language changes from other tests
    test.beforeAll(async ({ request }) => {
      // Create the test user
      const createUserResponse = await request.post('/api/admin/users', {
        data: {
          email: I18N_USER,
          login: I18N_USER,
          name: I18N_USER,
          password: I18N_PASSWORD,
        },
      });

      const userData = await createUserResponse.json();
      userId = userData.uid;
    });

    // Remove the user created in the beforeAll hook
    test.afterAll(async ({ request }) => {
      if (userId) {
        await request.delete(`/api/admin/users/${userId}`);
      }
    });

    // Map between languages in the language picker and the corresponding translation of the 'Language' label
    const languageMap: Record<string, string> = {
      Deutsch: 'Sprache',
      Español: 'Idioma',
      Français: 'Langue',
      'Português Brasileiro': 'Idioma',
      '中文（简体）': '语言',
      English: 'Language',
    };

    // Basic test which loops through the defined languages in the picker
    // and verifies that the corresponding label is translated correctly
    test('loads all the languages correctly', async ({ page, selectors }) => {
      // Navigate to profile page
      await page.goto('/profile');

      const LANGUAGE_SELECTOR = '[id="language-preference-select"]';

      // Loop through each language and test the translation
      for (const [language, label] of Object.entries(languageMap)) {
        // Check that the language selector is not disabled
        const languageSelector = page.locator(LANGUAGE_SELECTOR);
        await expect(languageSelector).not.toBeDisabled();

        // Click on the language selector
        await languageSelector.click();

        // Clear and type the language name
        await languageSelector.clear();
        await languageSelector.fill(language);

        // Press down arrow and enter to select the option
        await languageSelector.press('ArrowDown');
        await languageSelector.press('Enter');

        // Click the save preferences button
        const saveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
        await saveButton.click();

        // Check that the language label is visible
        const languageLabel = page.locator('label').filter({ hasText: label });
        await expect(languageLabel).toBeVisible();

        // Verify the language selector has the correct value
        await expect(languageSelector).toHaveValue(language);
      }
    });
  }
);

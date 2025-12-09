import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Alert Rules - Saved Searches',
  {
    tag: ['@alerting'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to alert rules page
      await page.goto('/alerting/list');
    });

    test('should display Saved searches button', async ({ page }) => {
      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await expect(savedSearchesButton).toBeVisible();
    });

    test('should open dropdown when clicking Saved searches button', async ({ page }) => {
      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const dialog = page.getByRole('dialog', { name: /saved searches/i });
      await expect(dialog).toBeVisible();
    });

    test('should show empty state when no saved searches exist', async ({ page }) => {
      // Clear localStorage to ensure no saved searches
      await page.evaluate(() => {
        localStorage.removeItem('grafana.alerting.savedSearches');
      });
      await page.reload();

      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const emptyState = page.getByText(/no saved searches/i);
      await expect(emptyState).toBeVisible();
    });

    test('should enable Save current search button when search query is entered', async ({ page }) => {
      // Enter a search query
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      // Open saved searches
      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const saveButton = page.getByRole('button', { name: /save current search/i });
      await expect(saveButton).toBeEnabled();
    });

    test('should disable Save current search button when search query is empty', async ({ page }) => {
      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const saveButton = page.getByRole('button', { name: /save current search/i });
      await expect(saveButton).toBeDisabled();
    });

    test('should save a new search', async ({ page }) => {
      // Enter a search query
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      // Open saved searches
      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      // Click save button
      const saveButton = page.getByRole('button', { name: /save current search/i });
      await saveButton.click();

      // Enter name and save
      const nameInput = page.getByPlaceholder(/enter a name/i);
      await nameInput.fill('My Firing Rules');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Verify the saved search appears in the list
      await expect(page.getByText('My Firing Rules')).toBeVisible();
    });

    test('should show validation error for duplicate name', async ({ page }) => {
      // First save a search
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const saveButton = page.getByRole('button', { name: /save current search/i });
      await saveButton.click();

      const nameInput = page.getByPlaceholder(/enter a name/i);
      await nameInput.fill('Duplicate Test');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Try to save another with the same name
      await saveButton.click();
      await nameInput.fill('Duplicate Test');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Verify validation error
      await expect(page.getByText(/already exists/i)).toBeVisible();
    });

    test('should apply a saved search', async ({ page }) => {
      // Create a saved search first
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const saveButton = page.getByRole('button', { name: /save current search/i });
      await saveButton.click();

      const nameInput = page.getByPlaceholder(/enter a name/i);
      await nameInput.fill('Apply Test');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Clear the search
      await searchInput.clear();
      await searchInput.press('Enter');

      // Apply the saved search
      await savedSearchesButton.click();
      await page.getByRole('button', { name: /apply search.*apply test/i }).click();

      // Verify the search input is updated
      await expect(searchInput).toHaveValue('state:firing');
    });

    test('should rename a saved search', async ({ page }) => {
      // Create a saved search
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const saveButton = page.getByRole('button', { name: /save current search/i });
      await saveButton.click();

      const nameInput = page.getByPlaceholder(/enter a name/i);
      await nameInput.fill('Original Name');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Open action menu and click rename
      await page.getByRole('button', { name: /actions/i }).click();
      await page.getByText(/rename/i).click();

      // Enter new name
      const renameInput = page.getByDisplayValue('Original Name');
      await renameInput.clear();
      await renameInput.fill('Renamed Search');
      await page.keyboard.press('Enter');

      // Verify the name was updated
      await expect(page.getByText('Renamed Search')).toBeVisible();
      await expect(page.getByText('Original Name')).not.toBeVisible();
    });

    test('should delete a saved search', async ({ page }) => {
      // Create a saved search
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const saveButton = page.getByRole('button', { name: /save current search/i });
      await saveButton.click();

      const nameInput = page.getByPlaceholder(/enter a name/i);
      await nameInput.fill('To Delete');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Verify it was saved
      await expect(page.getByText('To Delete')).toBeVisible();

      // Open action menu and click delete
      await page.getByRole('button', { name: /actions/i }).click();
      await page.getByText(/^delete$/i).click();

      // Confirm delete
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Verify it was deleted
      await expect(page.getByText('To Delete')).not.toBeVisible();
    });

    test('should set a search as default', async ({ page }) => {
      // Create a saved search
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const saveButton = page.getByRole('button', { name: /save current search/i });
      await saveButton.click();

      const nameInput = page.getByPlaceholder(/enter a name/i);
      await nameInput.fill('Default Test');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Set as default
      await page.getByRole('button', { name: /actions/i }).click();
      await page.getByText(/set as default/i).click();

      // Verify the star icon appears (indicating default)
      await expect(page.locator('[title="Default search"]')).toBeVisible();
    });

    test('should close dropdown when pressing Escape', async ({ page }) => {
      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      const dialog = page.getByRole('dialog', { name: /saved searches/i });
      await expect(dialog).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(dialog).not.toBeVisible();
    });

    test('should cancel save mode when pressing Escape', async ({ page }) => {
      // Enter a search query
      const searchInput = page.getByTestId('search-query-input');
      await searchInput.fill('state:firing');
      await searchInput.press('Enter');

      const savedSearchesButton = page.getByRole('button', { name: /saved searches/i });
      await savedSearchesButton.click();

      // Start save mode
      const saveButton = page.getByRole('button', { name: /save current search/i });
      await saveButton.click();

      const nameInput = page.getByPlaceholder(/enter a name/i);
      await expect(nameInput).toBeVisible();

      // Press Escape to cancel
      await page.keyboard.press('Escape');

      // Verify we're back to list mode
      await expect(nameInput).not.toBeVisible();
      await expect(saveButton).toBeVisible();
    });
  }
);

import { Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

/**
 * UI selectors for Saved Searches e2e tests.
 * Each selector is a function that takes the page and returns a locator.
 */
const ui = {
  // Main elements
  savedSearchesButton: (page: Page) => page.getByRole('button', { name: /saved searches/i }),
  dropdown: (page: Page) => page.getByRole('dialog', { name: /saved searches/i }),
  searchInput: (page: Page) => page.getByTestId('search-query-input'),

  // Save functionality
  saveButton: (page: Page) => page.getByRole('button', { name: /save current search/i }),
  saveConfirmButton: (page: Page) => page.getByRole('button', { name: /^save$/i }),
  saveNameInput: (page: Page) => page.getByPlaceholder(/enter a name/i),

  // Action menu
  actionsButton: (page: Page) => page.getByRole('button', { name: /actions/i }),
  renameMenuItem: (page: Page) => page.getByText(/rename/i),
  deleteMenuItem: (page: Page) => page.getByText(/^delete$/i),
  setAsDefaultMenuItem: (page: Page) => page.getByText(/set as default/i),
  deleteConfirmButton: (page: Page) => page.getByRole('button', { name: /^delete$/i }),

  // Indicators
  emptyState: (page: Page) => page.getByText(/no saved searches/i),
  defaultIcon: (page: Page) => page.locator('[title="Default search"]'),
  duplicateError: (page: Page) => page.getByText(/already exists/i),
};

/**
 * Helper to clear saved searches storage.
 * UserStorage uses localStorage as fallback, so we clear both potential keys.
 */
async function clearSavedSearches(page: Page) {
  await page.evaluate(() => {
    // Clear localStorage keys that might contain saved searches
    // UserStorage stores under 'grafana.userstorage.alerting' pattern
    const keysToRemove = Object.keys(localStorage).filter(
      (key) => key.includes('alerting') && (key.includes('savedSearches') || key.includes('userstorage'))
    );
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Also clear session storage visited flag
    const sessionKeysToRemove = Object.keys(sessionStorage).filter((key) => key.includes('alerting'));
    sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));
  });
}

test.describe(
  'Alert Rules - Saved Searches',
  {
    tag: ['@alerting'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Clear any saved searches from previous tests before navigating
      await page.goto('/alerting/list');
      await clearSavedSearches(page);
      await page.reload();
    });

    test.afterEach(async ({ page }) => {
      // Clean up saved searches after each test
      await clearSavedSearches(page);
    });

    test('should display Saved searches button', async ({ page }) => {
      await expect(ui.savedSearchesButton(page)).toBeVisible();
    });

    test('should open dropdown when clicking Saved searches button', async ({ page }) => {
      await ui.savedSearchesButton(page).click();

      await expect(ui.dropdown(page)).toBeVisible();
    });

    test('should show empty state when no saved searches exist', async ({ page }) => {
      // Storage is cleared in beforeEach, so we should see empty state
      await ui.savedSearchesButton(page).click();

      await expect(ui.emptyState(page)).toBeVisible();
    });

    test('should enable Save current search button when search query is entered', async ({ page }) => {
      // Enter a search query
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      // Open saved searches
      await ui.savedSearchesButton(page).click();

      await expect(ui.saveButton(page)).toBeEnabled();
    });

    test('should disable Save current search button when search query is empty', async ({ page }) => {
      await ui.savedSearchesButton(page).click();

      await expect(ui.saveButton(page)).toBeDisabled();
    });

    test('should save a new search', async ({ page }) => {
      // Enter a search query
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      // Open saved searches
      await ui.savedSearchesButton(page).click();

      // Click save button
      await ui.saveButton(page).click();

      // Enter name and save
      await ui.saveNameInput(page).fill('My Firing Rules');
      await ui.saveConfirmButton(page).click();

      // Verify the saved search appears in the list
      await expect(page.getByText('My Firing Rules')).toBeVisible();
    });

    test('should show validation error for duplicate name', async ({ page }) => {
      // First save a search
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      await ui.savedSearchesButton(page).click();

      await ui.saveButton(page).click();

      await ui.saveNameInput(page).fill('Duplicate Test');
      await ui.saveConfirmButton(page).click();

      // Try to save another with the same name
      await ui.saveButton(page).click();
      await ui.saveNameInput(page).fill('Duplicate Test');
      await ui.saveConfirmButton(page).click();

      // Verify validation error
      await expect(ui.duplicateError(page)).toBeVisible();
    });

    test('should apply a saved search', async ({ page }) => {
      // Create a saved search first
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      await ui.savedSearchesButton(page).click();

      await ui.saveButton(page).click();

      await ui.saveNameInput(page).fill('Apply Test');
      await ui.saveConfirmButton(page).click();

      // Clear the search
      await ui.searchInput(page).clear();
      await ui.searchInput(page).press('Enter');

      // Apply the saved search
      await ui.savedSearchesButton(page).click();
      await page.getByRole('button', { name: /apply search.*apply test/i }).click();

      // Verify the search input is updated
      await expect(ui.searchInput(page)).toHaveValue('state:firing');
    });

    test('should rename a saved search', async ({ page }) => {
      // Create a saved search
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      await ui.savedSearchesButton(page).click();

      await ui.saveButton(page).click();

      await ui.saveNameInput(page).fill('Original Name');
      await ui.saveConfirmButton(page).click();

      // Open action menu and click rename
      await ui.actionsButton(page).click();
      await ui.renameMenuItem(page).click();

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
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      await ui.savedSearchesButton(page).click();

      await ui.saveButton(page).click();

      await ui.saveNameInput(page).fill('To Delete');
      await ui.saveConfirmButton(page).click();

      // Verify it was saved
      await expect(page.getByText('To Delete')).toBeVisible();

      // Open action menu and click delete
      await ui.actionsButton(page).click();
      await ui.deleteMenuItem(page).click();

      // Confirm delete
      await ui.deleteConfirmButton(page).click();

      // Verify it was deleted
      await expect(page.getByText('To Delete')).not.toBeVisible();
    });

    test('should set a search as default', async ({ page }) => {
      // Create a saved search
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      await ui.savedSearchesButton(page).click();

      await ui.saveButton(page).click();

      await ui.saveNameInput(page).fill('Default Test');
      await ui.saveConfirmButton(page).click();

      // Set as default
      await ui.actionsButton(page).click();
      await ui.setAsDefaultMenuItem(page).click();

      // Verify the star icon appears (indicating default)
      await expect(ui.defaultIcon(page)).toBeVisible();
    });

    test('should close dropdown when pressing Escape', async ({ page }) => {
      await ui.savedSearchesButton(page).click();

      await expect(ui.dropdown(page)).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(ui.dropdown(page)).not.toBeVisible();
    });

    test('should cancel save mode when pressing Escape', async ({ page }) => {
      // Enter a search query
      await ui.searchInput(page).fill('state:firing');
      await ui.searchInput(page).press('Enter');

      await ui.savedSearchesButton(page).click();

      // Start save mode
      await ui.saveButton(page).click();

      await expect(ui.saveNameInput(page)).toBeVisible();

      // Press Escape to cancel
      await page.keyboard.press('Escape');

      // Verify we're back to list mode
      await expect(ui.saveNameInput(page)).not.toBeVisible();
      await expect(ui.saveButton(page)).toBeVisible();
    });
  }
);

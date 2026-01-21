import { Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

// Enable required feature toggles for Saved Searches (part of RuleList.v2)
test.use({
  featureToggles: {
    alertingListViewV2: true,
    alertingFilterV2: true,
    alertingSavedSearches: true,
  },
});

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
  defaultIcon: (page: Page) => page.getByRole('img', { name: /default search/i }),
  duplicateError: (page: Page) => page.getByText(/already exists/i),
};

/**
 * Helper to clear saved searches from UserStorage.
 * UserStorage persists data server-side via k8s API, so we need to delete via API.
 */
async function clearSavedSearches(page: Page) {
  // Get namespace and user info from Grafana config
  const storageInfo = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bootData = (window as any).grafanaBootData;
    const user = bootData?.user;
    const userUID = user?.uid === '' || !user?.uid ? String(user?.id ?? 'anonymous') : user.uid;
    const resourceName = `alerting:${userUID}`;
    const namespace = bootData?.settings?.namespace || 'default';

    return { namespace, resourceName };
  });

  // Delete the UserStorage resource
  try {
    await page.request.delete(
      `/apis/userstorage.grafana.app/v0alpha1/namespaces/${storageInfo.namespace}/user-storage/${storageInfo.resourceName}`
    );
  } catch (error) {
    // Ignore 404 errors (resource doesn't exist)
    if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) {
      console.warn('Failed to clear saved searches:', error);
    }
  }

  // Also clear localStorage as fallback storage
  await page.evaluate(({ resourceName }) => {
    // The UserStorage key pattern is always `{resourceName}:{key}`
    // For saved searches, the key is 'savedSearches'
    const key = `${resourceName}:savedSearches`;
    window.localStorage.removeItem(key);
  }, storageInfo);

  // Clear session storage visited flag
  await page.evaluate(() => {
    window.sessionStorage.removeItem('grafana.alerting.ruleList.visited');
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

      await ui.saveNameInput(page).fill('Firing Rules');
      await ui.saveConfirmButton(page).click();

      // Clear the search
      await ui.searchInput(page).clear();
      await ui.searchInput(page).press('Enter');

      // Apply the saved search
      await ui.savedSearchesButton(page).click();
      await page.getByRole('button', { name: /apply.*search.*firing rules/i }).click();

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
      const renameInput = page.getByRole('textbox', { name: /enter a name/i });
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

      // Press Escape to cancel - this closes the entire dropdown
      await page.keyboard.press('Escape');

      // Verify the entire dialog is closed
      await expect(ui.dropdown(page)).not.toBeVisible();
      await expect(ui.saveButton(page)).not.toBeVisible();
    });
  }
);

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Pin nav items',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Set localStorage to dock the navigation
      await page.evaluate(() => {
        localStorage.setItem('grafana.navigation.docked', 'true');
      });
    });

    test('should pin the selected menu item and add it as a Bookmarks menu item child', async ({ page, selectors }) => {
      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeVisible();

      const navList = navMenu.locator('ul[aria-label="Navigation"]');
      await expect(navList).toBeVisible();

      // Check if the Bookmark section is visible
      const bookmarksItem = navList.locator('li').nth(1);
      await expect(bookmarksItem).toBeVisible();
      await expect(bookmarksItem).toContainText('Bookmarks');

      // Check if the Administration section is visible
      const adminItem = navList.locator('li').last();
      await expect(adminItem).toBeVisible();
      await expect(adminItem).toContainText('Administration');

      // Click the "Add to Bookmarks" button in the Administration section
      const addToBookmarksButton = adminItem.getByLabel('Add to Bookmarks');
      await addToBookmarksButton.click({ force: true });

      // Check if the Administration menu item is visible in the Bookmarks section
      const expandBookmarksButton = bookmarksItem.locator('button[aria-label="Expand section: Bookmarks"]');
      await expect(expandBookmarksButton).toBeVisible();
      await expandBookmarksButton.click({ force: true });

      const administrationLink = bookmarksItem.locator('a').filter({ hasText: 'Administration' });
      await expect(administrationLink).toBeVisible();
    });

    test('should unpin the item and remove it from the Bookmarks section', async ({ page, selectors }) => {
      // Set Administration as a pinned item
      await page.evaluate(() => {
        localStorage.setItem(
          'grafana.user.preferences',
          JSON.stringify({
            navbar: { bookmarkUrls: ['/admin'] },
          })
        );
      });

      // Visit the home page
      await page.goto('/');

      // Reload the page to apply the docked navigation
      await page.reload();

      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeVisible();

      const navList = navMenu.locator('ul[aria-label="Navigation"]');
      await expect(navList).toBeVisible();

      // Check if the Bookmark section is visible
      const bookmarksItem = navList.locator('li').nth(1);
      await expect(bookmarksItem).toBeVisible();
      await expect(bookmarksItem).toContainText('Bookmarks');

      // Expand the Bookmarks section
      const expandBookmarksButton = bookmarksItem.getByLabel('Expand section: Bookmarks');
      await expandBookmarksButton.click({ force: true });

      // Check that Administration is visible in bookmarks
      const administrationLink = bookmarksItem.locator('a').filter({ hasText: 'Administration' });
      await expect(administrationLink).toBeVisible();

      // Click the "Remove from Bookmarks" button
      const removeFromBookmarksButton = bookmarksItem.getByLabel('Remove from Bookmarks');
      await removeFromBookmarksButton.click({ force: true });

      // Check that Administration is no longer in bookmarks
      await expect(bookmarksItem.locator('a')).toHaveCount(1);
      await expect(bookmarksItem.locator('a').filter({ hasText: 'Administration' })).toBeHidden();
    });
  }
);

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Pin nav items',
  {
    tag: ['@various'],
  },
  () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('grafana.navigation.docked', 'true');
      });
    });

    test('should pin administration and show it in the primary nav', async ({ page, selectors }) => {
      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeVisible();

      const navList = navMenu.locator('ul[aria-label="Navigation"]');
      await expect(navList).toBeVisible();

      const showMore = navList.getByText('Show me more');
      await showMore.click();

      const adminInOverflow = navList.locator('a').filter({ hasText: 'Administration' }).first();
      await expect(adminInOverflow).toBeVisible();

      const pinButton = adminInOverflow.locator('..').getByLabel(/Pin Administration/i);
      await pinButton.click({ force: true });

      await expect(navList.locator('a').filter({ hasText: 'Administration' }).first()).toBeVisible();
    });

    test('should unpin administration and move it back to show me more', async ({ page, selectors }) => {
      await page.evaluate(() => {
        localStorage.setItem(
          'grafana.user.preferences',
          JSON.stringify({
            navbar: {
              layout: {
                version: 1,
                pinnedIds: ['cfg'],
              },
            },
          })
        );
      });

      await page.goto('/');
      await page.reload();

      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeVisible();

      const navList = navMenu.locator('ul[aria-label="Navigation"]');
      const adminLink = navList.locator('a').filter({ hasText: 'Administration' }).first();
      await expect(adminLink).toBeVisible();

      const unpinButton = adminLink.locator('..').getByLabel(/Unpin Administration/i);
      await unpinButton.click({ force: true });

      await expect(navList.getByText('Show me more')).toBeVisible();
    });
  }
);

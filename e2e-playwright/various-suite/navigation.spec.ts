import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Docked Navigation',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // This is a breakpoint where the mega menu can be docked (and docked is the default state)
      await page.setViewportSize({ width: 1280, height: 800 });
    });

    test('should remain un-docked when reloading the page', async ({ page, selectors }) => {
      // Undock the menu
      const undockButton = page.getByRole('button', { name: 'Undock menu' });
      await undockButton.click();

      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeHidden();

      // Reload the page
      await page.reload();
      await expect(navMenu).toBeHidden();
    });

    test('Can re-dock after undock', async ({ page, selectors }) => {
      // Undock the menu
      const undockButton = page.getByRole('button', { name: 'Undock menu' });
      await undockButton.click();

      const openMenuButton = page.getByRole('button', { name: 'Open menu' });
      await openMenuButton.click();

      const dockButton = page.getByRole('button', { name: 'Dock menu' });
      await dockButton.click();

      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeVisible();
    });

    test('should remain in same state when navigating to another page', async ({ page, selectors }) => {
      // Undock the menu
      const undockButton = page.getByRole('button', { name: 'Undock menu' });
      await undockButton.click();

      // Navigate
      const openMenuButton = page.getByRole('button', { name: 'Open menu' });
      await openMenuButton.click();

      const administrationLink = page.getByRole('link', { name: 'Administration' });
      await administrationLink.click();

      // Still undocked
      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeHidden();

      // Dock the menu
      await openMenuButton.click();
      const dockButton = page.getByRole('button', { name: 'Dock menu' });
      await dockButton.click();

      // Navigate
      const usersLink = page.getByRole('link', { name: 'Users' });
      await usersLink.click();

      // Still docked
      await expect(navMenu).toBeVisible();
    });

    test('should undock on smaller viewport sizes', async ({ page, selectors }) => {
      await page.setViewportSize({ width: 1120, height: 1080 });
      await page.reload();

      const navMenu = page.getByTestId(selectors.components.NavMenu.Menu);
      await expect(navMenu).toBeHidden();
    });
  }
);

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Keyboard shortcuts',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page, selectors }) => {
      await page.goto('/');

      // Wait for the page to load
      const panelTitle = page.getByTestId(selectors.components.Panels.Panel.title('Latest from the blog'));
      await expect(panelTitle).toBeVisible();
    });

    test('sequence shortcuts should work', async ({ page, selectors }) => {
      // Navigate to explore with 'ge' shortcut
      await page.keyboard.type('ge');
      const exploreContainer = page.getByTestId(selectors.pages.Explore.General.container);
      await expect(exploreContainer).toBeVisible();

      // Navigate to profile with 'gp' shortcut
      await page.keyboard.type('gp');
      const preferencesSaveButton = page.getByTestId(selectors.components.UserProfile.preferencesSaveButton);
      await expect(preferencesSaveButton).toBeVisible();

      // Navigate back to home with 'gh' shortcut
      await page.keyboard.type('gh');
      const panelTitle = page.getByTestId(selectors.components.Panels.Panel.title('Latest from the blog'));
      await expect(panelTitle).toBeVisible();
    });

    test('ctrl+z should zoom out the time range', async ({ page, selectors }) => {
      // Navigate to explore
      await page.keyboard.type('ge');
      const exploreContainer = page.getByTestId(selectors.pages.Explore.General.container);
      await expect(exploreContainer).toBeVisible();

      // Set time range
      const timePickerButton = page.getByTestId(selectors.components.TimePicker.openButton);
      await timePickerButton.click();

      const fromField = page.getByTestId(selectors.components.TimePicker.fromField);
      await fromField.fill('2024-06-05 10:05:00');

      const toField = page.getByTestId(selectors.components.TimePicker.toField);
      await toField.fill('2024-06-05 10:06:00');

      const applyTimeRangeButton = page.getByTestId(selectors.components.TimePicker.applyTimeRange);
      await applyTimeRangeButton.click();

      await page.keyboard.press('Control+z');

      const expectedRange = 'Time range selected: 2024-06-05 10:03:30 to 2024-06-05 10:07:30';
      await expect(timePickerButton).toHaveAttribute('aria-label', expectedRange);
    });

    test('time range shortcuts should work', async ({ page, selectors }) => {
      // Navigate to explore
      await page.keyboard.type('ge');
      const exploreContainer = page.getByTestId(selectors.pages.Explore.General.container);
      await expect(exploreContainer).toBeVisible();

      // Set time range
      const timePickerButton = page.getByTestId(selectors.components.TimePicker.openButton);
      await timePickerButton.click();

      const fromField = page.getByTestId(selectors.components.TimePicker.fromField);
      await fromField.fill('2024-06-05 10:05:00');

      const toField = page.getByTestId(selectors.components.TimePicker.toField);
      await toField.fill('2024-06-05 10:06:00');

      const applyTimeRangeButton = page.getByTestId(selectors.components.TimePicker.applyTimeRange);
      await applyTimeRangeButton.click();

      let expectedRange = 'Time range selected: 2024-06-05 10:05:00 to 2024-06-05 10:06:00';
      await expect(timePickerButton).toHaveAttribute('aria-label', expectedRange);

      // Use time range shortcut to move back
      await page.keyboard.press('t');
      await page.keyboard.press('ArrowLeft');

      expectedRange = 'Time range selected: 2024-06-05 10:04:00 to 2024-06-05 10:05:00'; // 1 min back
      await expect(timePickerButton).toHaveAttribute('aria-label', expectedRange);
    });

    test('ctrl+o should toggle shared crosshair', async ({ page, selectors }) => {
      // Navigate to a new dashboard
      await page.goto('/dashboard/new?orgId=1');

      // Wait for dashboard to load
      await page.waitForLoadState('networkidle');

      // Wait for dashboard to be fully initialized by checking for dashboard content
      await page
        .locator('[data-testid*="dashboard"]')
        .or(page.locator('text=Start your new dashboard'))
        .first()
        .waitFor({ state: 'visible' });

      // Test the keyboard shortcut first in the main dashboard view
      const currentUrl = page.url();
      const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';

      // Test that mod+o works in the main dashboard (should not trigger file dialog)
      console.log('Testing mod+o in main dashboard view...');
      await page.keyboard.press(`${modKey}+o`);
      expect(page.url()).toBe(currentUrl); // Should not navigate away

      // Now open settings to check if the state actually changed
      await page.keyboard.press('d');
      await page.keyboard.press('s');

      // Wait for settings page to load by checking for the General tab or settings content
      await page
        .locator('text=General')
        .or(page.locator('[data-testid*="dashboard-settings"]'))
        .waitFor({ state: 'visible' });

      // Wait for Panel options section to be visible and scroll to it
      const panelOptionsSection = page.locator('text=Panel options');
      await panelOptionsSection.waitFor({ state: 'visible' });
      await panelOptionsSection.scrollIntoViewIfNeeded();

      // Wait for radio buttons to be visible
      await page
        .locator('[role="radiogroup"]')
        .last()
        .locator('input[type="radio"]')
        .first()
        .waitFor({ state: 'visible' });

      // Check current state - after one mod+o press, it should be crosshair (1)
      await expect(page.locator('[role="radiogroup"]').last().locator('input[type="radio"]').nth(1)).toBeChecked(); // Shared crosshair

      // Test second press in the main dashboard view (should go to tooltip)
      await page.keyboard.press(`${modKey}+o`);
      await expect(page.locator('[role="radiogroup"]').last().locator('input[type="radio"]').nth(2)).toBeChecked(); // Shared tooltip

      // Test third press in the main dashboard view (should go back to default)
      await page.keyboard.press(`${modKey}+o`);
      await expect(page.locator('[role="radiogroup"]').last().locator('input[type="radio"]').nth(0)).toBeChecked(); // Default
    });
  }
);

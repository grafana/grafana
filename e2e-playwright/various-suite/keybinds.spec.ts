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
  }
);

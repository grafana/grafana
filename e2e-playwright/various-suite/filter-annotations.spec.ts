import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Annotations filtering',
  {
    tag: ['@various'],
  },
  () => {
    const DASHBOARD_ID = 'ed155665';

    test('Tests switching filter type updates the UI accordingly', async ({ page, selectors, gotoDashboardPage }) => {
      // Navigate to dashboard
      await gotoDashboardPage({ uid: DASHBOARD_ID });

      // Enter edit mode
      const editButton = page.getByTestId(selectors.components.NavToolbar.editDashboard.editButton);
      await expect(editButton).toBeVisible();
      await editButton.click();

      // Open settings
      const settingsButton = page.getByTestId(selectors.components.NavToolbar.editDashboard.settingsButton);
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      // Navigate to annotations tab
      const annotationsTab = page.getByTestId(selectors.components.Tab.title('Annotations'));
      await annotationsTab.click();

      // Click "New query"
      const newQueryButton = page.getByText('New query');
      await newQueryButton.click();

      // Set annotation name
      const nameInput = page.getByTestId(selectors.pages.Dashboard.Settings.Annotations.Settings.name);
      await nameInput.clear();
      await nameInput.fill('Red - Panel two');

      // Test filter type switching
      const showInLabel = page.getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel);
      await expect(showInLabel).toBeVisible();

      // Test "All panels" option
      const annotationsTypeInput = page.getByTestId(selectors.components.Annotations.annotationsTypeInput);
      await annotationsTypeInput.click();
      await page.keyboard.type('All panels');
      await page.keyboard.press('Enter');

      const annotationsChoosePanelInput = page.getByTestId(
        selectors.components.Annotations.annotationsChoosePanelInput
      );
      await expect(annotationsChoosePanelInput).not.toBeVisible();

      // Test "All panels except" option
      await annotationsTypeInput.click();
      await page.keyboard.type('All panels except');
      await page.keyboard.press('Enter');
      await expect(annotationsChoosePanelInput).toBeVisible();

      // Test "Selected panels" option
      await annotationsTypeInput.click();
      await page.keyboard.type('Selected panels');
      await page.keyboard.press('Enter');
      await expect(annotationsChoosePanelInput).toBeVisible();

      // Select "Panel two"
      await annotationsChoosePanelInput.click();
      await page.keyboard.type('Panel two');
      await page.keyboard.press('Enter');

      // Click outside to close dropdown
      await page.click('body');

      // Go back to dashboard
      const backToDashboardButton = page.getByTestId(
        selectors.components.NavToolbar.editDashboard.backToDashboardButton
      );
      await expect(backToDashboardButton).toBeVisible();
      await backToDashboardButton.click();

      // Test annotation controls
      const dashboardControls = page.getByTestId(selectors.pages.Dashboard.Controls);
      await expect(dashboardControls).toBeVisible();

      // Test "Red - Panel two" annotation toggle
      const redPanelTwoLabel = page.getByLabel('Red - Panel two');
      await expect(redPanelTwoLabel).toBeVisible();

      const redPanelTwoToggleParent = page.getByLabel('Red - Panel two').locator('..');
      const redPanelTwoCheckbox = redPanelTwoToggleParent.locator('input');

      // Check initial state
      await expect(redPanelTwoCheckbox).toBeChecked();

      // Uncheck and verify
      await redPanelTwoCheckbox.uncheck({ force: true });
      await expect(redPanelTwoCheckbox).not.toBeChecked();

      // Check again and verify
      await redPanelTwoCheckbox.check({ force: true });
      await expect(redPanelTwoCheckbox).toBeChecked();

      // Test "Red, only panel 1" annotation toggle
      const redOnlyPanelOneLabel = page.getByLabel('Red, only panel 1');
      await expect(redOnlyPanelOneLabel).toBeVisible();

      const redOnlyPanelOneToggleParent = page.getByLabel('Red, only panel 1').locator('..');
      const redOnlyPanelOneCheckbox = redOnlyPanelOneToggleParent.locator('input');
      await expect(redOnlyPanelOneCheckbox).toBeChecked();

      // Verify annotations in panel
      const panelOne = page.getByTestId(selectors.components.Panels.Panel.title('Panel one'));
      await expect(panelOne).toBeVisible();

      const annotationMarkers = panelOne.getByTestId(selectors.pages.Dashboard.Annotations.marker);
      await expect(annotationMarkers).toHaveCount(4);
    });
  }
);

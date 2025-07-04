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
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_ID });

      // Enter edit mode
      const editButton = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton);
      await expect(editButton).toBeVisible();
      await editButton.click();

      // Open settings
      const settingsButton = dashboardPage.getByGrafanaSelector(
        selectors.components.NavToolbar.editDashboard.settingsButton
      );
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      // Navigate to annotations tab
      const annotationsTab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Annotations'));
      await annotationsTab.click();

      // Click "New query"
      const newQueryButton = page.getByText('New query');
      await newQueryButton.click();

      // Set annotation name
      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Annotations.Settings.name
      );
      await nameInput.fill('Red - Panel two');

      // Test filter type switching
      const showInLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel
      );
      await expect(showInLabel).toBeVisible();

      // Test "All panels" option
      const annotationsTypeInput = dashboardPage
        .getByGrafanaSelector(selectors.components.Annotations.annotationsTypeInput)
        .locator('input');
      await annotationsTypeInput.fill('All panels');
      await annotationsTypeInput.press('Enter');

      const annotationsChoosePanelInput = dashboardPage.getByGrafanaSelector(
        selectors.components.Annotations.annotationsChoosePanelInput
      );
      await expect(annotationsChoosePanelInput).toBeHidden();

      // Test "All panels except" option
      await annotationsTypeInput.fill('All panels except');
      await annotationsTypeInput.press('Enter');
      await expect(annotationsChoosePanelInput).toBeVisible();

      // Test "Selected panels" option
      await annotationsTypeInput.fill('Selected panels');
      await annotationsTypeInput.press('Enter');
      await expect(annotationsChoosePanelInput).toBeVisible();

      // Select "Panel two"
      await annotationsTypeInput.fill('Panel two');
      await annotationsTypeInput.press('Enter');

      // Click outside to close dropdown
      await page.click('body', { position: { x: 0, y: 0 } });

      // Go back to dashboard
      const backToDashboardButton = dashboardPage.getByGrafanaSelector(
        selectors.components.NavToolbar.editDashboard.backToDashboardButton
      );
      await expect(backToDashboardButton).toBeVisible();
      await backToDashboardButton.click();

      // Test annotation controls
      const dashboardControls = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls);
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
      await expect(redPanelTwoCheckbox).toBeChecked({ checked: false });

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
      const panelOne = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel one'));
      await expect(panelOne).toBeVisible();

      const annotationMarkers = panelOne.getByTestId(selectors.pages.Dashboard.Annotations.marker);
      await expect(annotationMarkers).toHaveCount(4);
    });
  }
);

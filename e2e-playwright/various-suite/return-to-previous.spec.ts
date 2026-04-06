import { test, expect } from '@grafana/plugin-e2e';

test.describe.skip(
  'ReturnToPrevious button',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Navigate directly to alert rule detail -- no fragile list UI navigation
      await page.goto('/alerting/grafana/bddn0v6f1kgzkc/view');
      const alertRuleUrl = page.url();

      // Click "View panel" link -- triggers ReturnToPrevious
      const viewPanelLink = page.getByRole('link', { name: 'View panel' });
      await viewPanelLink.click();

      // Store the alert rule URL for later comparison
      test.info().annotations.push({
        type: 'alertRuleUrl',
        description: alertRuleUrl,
      });
    });

    test('should appear when changing context and go back to alert rule when clicking "Back"', async ({
      page,
      selectors,
    }) => {
      // Check whether all elements of RTP are available
      const buttonGroup = page.getByTestId(selectors.components.ReturnToPrevious.buttonGroup);
      await expect(buttonGroup).toBeVisible();

      const dismissButton = page.getByTestId(selectors.components.ReturnToPrevious.dismissButton);
      await expect(dismissButton).toBeVisible();

      const backButton = page.getByTestId(selectors.components.ReturnToPrevious.backButton);
      await expect(backButton).toBeVisible();

      // Check that the button contains the expected text
      await expect(backButton.getByText('Back to e2e-ReturnToPrevious-test')).toBeVisible();

      // Click the back button
      await backButton.click();

      // Check whether the RTP button leads back to alert rule
      const alertRuleUrl = test.info().annotations.find((a) => a.type === 'alertRuleUrl')?.description;
      expect(page.url()).toBe(alertRuleUrl);
    });

    test('should disappear when clicking "Dismiss"', async ({ page, selectors }) => {
      const dismissButton = page.getByTestId(selectors.components.ReturnToPrevious.dismissButton);
      await expect(dismissButton).toBeVisible();
      await dismissButton.click();

      const buttonGroup = page.getByTestId(selectors.components.ReturnToPrevious.buttonGroup);
      await expect(buttonGroup).toBeHidden();
    });

    test('should not persist when going back to the alert rule details view', async ({ page, selectors }) => {
      const buttonGroup = page.getByTestId(selectors.components.ReturnToPrevious.buttonGroup);
      await expect(buttonGroup).toBeVisible();

      // Navigate directly to the alert rule detail page
      // RTP auto-dismisses because the URL matches the stored href
      await page.goto('/alerting/grafana/bddn0v6f1kgzkc/view');

      // The ReturnToPrevious button should not exist
      const rtpButtonGroup = page.getByTestId(selectors.components.ReturnToPrevious.buttonGroup);
      await expect(rtpButtonGroup).toBeHidden();
    });

    test('should override the button label and change the href when user changes alert rules', async ({
      page,
      selectors,
    }) => {
      const backButton = page.getByTestId(selectors.components.ReturnToPrevious.backButton);
      await expect(backButton.getByText('Back to e2e-ReturnToPrevious-test')).toBeVisible();

      // Navigate directly to the second alert rule detail page
      await page.goto('/alerting/grafana/dddyksihq7h1ca/view');
      const alertRule2Url = page.url();

      // Click "View panel" link on the second rule
      const viewPanelLink = page.getByRole('link', { name: 'View panel' });
      await viewPanelLink.click();

      // Check that the button now shows the new alert rule name
      const newBackButton = page.getByTestId(selectors.components.ReturnToPrevious.backButton);
      await expect(newBackButton.getByText('Back to e2e-ReturnToPrevious-test-2')).toBeVisible();

      // Click the back button
      await newBackButton.click();

      // The ReturnToPrevious button should disappear
      const buttonGroup = page.getByTestId(selectors.components.ReturnToPrevious.buttonGroup);
      await expect(buttonGroup).toBeHidden();

      // Check whether the RTP button leads back to the second alert rule
      expect(page.url()).toBe(alertRule2Url);
    });
  }
);

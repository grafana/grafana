import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'ReturnToPrevious button',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page, selectors }) => {
      // Navigate to alerting list
      await page.goto('/alerting/list');

      // Click on the first group toggle to expand it
      const groupToggle = page.getByTestId(selectors.components.AlertRules.groupToggle);
      await groupToggle.first().click();

      // Click on the toggle to expand the content
      const toggle = page.getByTestId(selectors.components.AlertRules.toggle);
      await toggle.click();

      // Click on the "View" link
      const viewLink = page.getByRole('link', { name: 'View' });
      await viewLink.click();

      // Store the alert rule URL for later comparison
      const alertRuleUrl = page.url();

      // Click on "View panel" link
      const viewPanelLink = page.getByRole('link', { name: 'View panel' });
      await viewPanelLink.click();

      // Store the URL for use in tests
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

      // Navigate back to alerting list
      await page.goto('/alerting/list');

      // Click on the first group toggle
      const groupToggle = page.getByTestId(selectors.components.AlertRules.groupToggle);
      await groupToggle.first().click();

      // Click on the "View" link
      const viewLink = page.getByRole('link', { name: 'View' });
      await viewLink.click();

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

      // Navigate back to alerting list
      await page.goto('/alerting/list');

      // Click on the last group toggle (different alert rule)
      const groupToggle = page.getByTestId(selectors.components.AlertRules.groupToggle);
      await groupToggle.last().click();

      // Click on the "View" link
      const viewLink = page.getByRole('link', { name: 'View' });
      await viewLink.click();

      // Store the second alert rule URL
      const alertRule2Url = page.url();

      // Click on "View panel" link
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

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Query editor',
  {
    tag: ['@various'],
  },
  () => {
    test('Undo should work in query editor for prometheus', async ({ page, components }) => {
      // Visit the explore page
      await page.goto('/explore');

      // Select the prometheus data source
      await components.dataSourcePicker.set('gdev-prometheus');

      const queryText = `rate(http_requests_total{job="grafana"}[5m])`;

      // Click on the Code radio button
      const codeRadioButton = page.getByRole('radio', { name: 'Code' });
      await expect(codeRadioButton).toBeVisible();
      await codeRadioButton.click();

      // Wait for Monaco editor to load
      await page.waitForSelector('.monaco-editor');

      // Type the query text and then backspace
      const queryField = page.locator('.monaco-editor textarea');
      await queryField.fill(queryText);
      await queryField.press('Backspace');

      // Verify the text is truncated
      await expect(page.getByText(queryText.slice(0, -1))).toBeVisible();

      // Use undo (Ctrl+Z)
      await queryField.press('Control+z');

      // Verify the full query text is restored
      await expect(page.getByText(queryText)).toBeVisible();

      // Verify no error alerts are visible
      const errorAlert = page.getByTestId('alert-error');
      await expect(errorAlert).toBeHidden();
    });
  }
);

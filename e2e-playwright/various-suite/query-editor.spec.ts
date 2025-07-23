import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Query editor',
  {
    tag: ['@various'],
  },
  () => {
    test('Undo should work in query editor for prometheus', async ({ page }) => {
      // Visit the explore page
      await page.goto('/explore');

      // Click on the data source picker
      const dataSourcePicker = page.getByTestId('data-testid Data source picker select container');
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      // Select the prometheus data source
      const prometheusOption = page.getByText('gdev-prometheus');
      await expect(prometheusOption).toBeVisible();
      await prometheusOption.click();

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

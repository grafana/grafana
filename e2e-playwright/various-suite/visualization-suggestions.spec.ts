import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Visualization suggestions',
  {
    tag: ['@various'],
  },
  () => {
    test('Should be shown and clickable', async ({ page, selectors }) => {
      // Open dashboard with edit panel
      await page.goto('/d/aBXrJ0R7z?editPanel=9');

      // Try visualization suggestions
      const toggleVizPicker = page.getByTestId(selectors.components.PanelEditor.toggleVizPicker);
      await toggleVizPicker.click();

      // Click on the "Suggestions" radio button
      const suggestionsRadioButton = page
        .getByTestId(selectors.components.RadioButton.container)
        .filter({ hasText: 'Suggestions' });
      await suggestionsRadioButton.click();

      // Verify we see suggestions
      const lineChartCard = page.getByTestId(selectors.components.VisualizationPreview.card('Line chart'));
      await expect(lineChartCard).toBeVisible();

      // Verify search works
      const searchInput = page.getByPlaceholder('Search for...');
      await searchInput.fill('Table');

      // Should no longer see line chart
      await expect(lineChartCard).not.toBeVisible();

      // Select a visualization
      const tableCard = page.getByTestId(selectors.components.VisualizationPreview.card('Table'));
      await tableCard.click();

      // Verify table header is visible
      const tableHeader = page.getByRole('row', { name: 'table header' });
      await expect(tableHeader).toBeVisible();
    });
  }
);

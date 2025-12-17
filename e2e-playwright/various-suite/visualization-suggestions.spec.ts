import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Visualization suggestions',
  {
    tag: ['@various'],
  },
  () => {
    test('Should be shown and clickable', async ({ page, selectors, gotoPanelEditPage }) => {
      // Open dashboard with edit panel
      const panelEditPage = await gotoPanelEditPage({
        dashboard: {
          uid: 'aBXrJ0R7z',
        },
        id: '9',
      });

      // Try visualization suggestions
      await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await panelEditPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      // Verify we see suggestions
      const lineChartCard = panelEditPage.getByGrafanaSelector(
        selectors.components.VisualizationPreview.card('Line chart')
      );
      await expect(lineChartCard).toBeVisible();

      // TODO: in this part of the test, we will change the query and the transforms and observe suggestions being updated.

      // Select a visualization
      await panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();

      // Verify table header is visible
      await expect(page.getByRole('grid').getByRole('row').first()).toBeVisible();
    });
  }
);

import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    newVizSuggestions: true,
    externalVizSuggestions: true,
    dashboardNewLayouts: true,
  },
  viewport: {
    width: 800,
    height: 1500,
  },
});

test.describe(
  'Visualization suggestions v2',
  {
    tag: ['@various', '@suggestions'],
  },
  () => {
    test('Should be shown and clickable for existing panel without auto-selection', async ({
      selectors,
      gotoPanelEditPage,
    }) => {
      // Open dashboard with edit panel (existing panel - should NOT auto-select first suggestion)
      const panelEditPage = await gotoPanelEditPage({
        dashboard: {
          uid: 'aBXrJ0R7z',
        },
        id: '9',
      });

      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).locator('.uplot'),
        'time series to be rendered inside panel'
      ).toBeVisible();

      // Try visualization suggestions
      await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await panelEditPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      // Verify we see suggestions
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Line chart')),
        'line chart suggestion to be rendered'
      ).toBeVisible();

      // For existing panels, verify the original time series is still rendered (no auto-selection)
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).locator('.uplot'),
        'time series should still be rendered since this is an existing panel'
      ).toBeVisible();

      // TODO: in this part of the test, we will change the query and the transforms and observe suggestions being updated.

      // Select a visualization and verify table header is visible from preview
      await panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();
      await expect(
        panelEditPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.content)
          .getByRole('grid')
          .getByRole('row')
          .first(),
        'table to be rendered inside panel'
      ).toBeVisible();

      // Previewing a suggestion changes the panel, so discard button should be enabled
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button enabled after previewing suggestion'
      ).toBeEnabled();

      // Apply the suggestion by clicking Edit and verify panel options are visible
      await panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.confirm('Table')).click();
      await expect(
        panelEditPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.content)
          .getByRole('grid')
          .getByRole('row')
          .first(),
        'table to be rendered inside panel'
      ).toBeVisible();
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.header),
        'options pane to be rendered'
      ).toBeVisible();
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button enabled now that panel is dirty'
      ).toBeEnabled();
    });

    test('should persist preview when toggling viz picker off', async ({ selectors, gotoPanelEditPage }) => {
      // Open dashboard with edit panel (existing panel - originally time series)
      const panelEditPage = await gotoPanelEditPage({
        dashboard: {
          uid: 'aBXrJ0R7z',
        },
        id: '9',
      });

      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).locator('.uplot'),
        'time series to be rendered inside panel'
      ).toBeVisible();

      // Try visualization suggestions
      await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await panelEditPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      // Verify we see suggestions
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Line chart')),
        'line chart suggestion to be rendered'
      ).toBeVisible();

      // For existing panels, no auto-selection should occur - verify time series is still rendered
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).locator('.uplot'),
        'time series should still be rendered (no auto-selection for existing panels)'
      ).toBeVisible();

      // Select a visualization to preview it
      await panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();
      await expect(
        panelEditPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.content)
          .getByRole('grid')
          .getByRole('row')
          .first(),
        'table to be rendered inside panel'
      ).toBeVisible();

      // Previewing a suggestion changes the panel, so discard button should be enabled
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button enabled after previewing suggestion'
      ).toBeEnabled();

      // Toggle the viz picker off - the preview persists
      await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();

      // Verify the table preview persists (not restored to original time series)
      await expect(
        panelEditPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.content)
          .getByRole('grid')
          .getByRole('row')
          .first(),
        'table preview persists after toggling viz picker off'
      ).toBeVisible();

      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.header),
        'options pane to be rendered'
      ).toBeVisible();

      // Discard button should still be enabled since the preview is a change
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button still enabled since preview changed the panel'
      ).toBeEnabled();
    });

    test('should persist preview when navigating back to dashboard for existing panel', async ({
      page,
      selectors,
      gotoPanelEditPage,
    }) => {
      // Open dashboard with edit panel (existing panel - originally a time series)
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
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Line chart')),
        'line chart suggestion to be rendered'
      ).toBeVisible();

      // For existing panels, no auto-selection should occur
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).locator('.uplot'),
        'time series should still be rendered (no auto-selection for existing panels)'
      ).toBeVisible();

      // Select a visualization to preview it
      await panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();
      await expect(page.getByRole('grid').getByRole('row').first(), 'table row to be rendered').toBeVisible();

      // Previewing a suggestion changes the panel, so discard button should be enabled
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button enabled after previewing suggestion'
      ).toBeEnabled();

      // Navigate back to the dashboard - the preview persists even without clicking Edit
      await panelEditPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      // Verify the table preview persisted on the dashboard
      await expect(
        page.locator('[data-viz-panel-key="panel-9"]').getByRole('grid'),
        'table panel is visible (preview persisted)'
      ).toBeVisible();
    });

    test('should auto-select first suggestion for new panel and preview is persisted when navigating back', async ({
      page,
      selectors,
      gotoDashboardPage,
    }) => {
      // New dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Press the empty-state Create new panel button
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();
      await page.getByText('Configure').first().click();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();

      // Verify we see suggestions on load
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Line chart')),
        'line chart suggestion to be rendered'
      ).toBeVisible();

      // For new panels, the first suggestion (Line chart) should be auto-selected/previewed
      // Verify the Edit button is visible for the auto-selected suggestion
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.confirm('Line chart')),
        'edit button should be visible for auto-selected Line chart'
      ).toBeVisible();

      // Select a different visualization
      await dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();
      await expect(page.getByRole('grid').getByRole('row').first(), 'table row to be rendered').toBeVisible();

      // Navigate back to the dashboard without clicking Edit
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      // Verify the table panel is visible on the dashboard (preview was persisted)
      await expect(
        page.locator('[data-viz-panel-key="panel-1"]').getByRole('grid'),
        'table panel is visible on the dashboard'
      ).toBeVisible();
    });
  }
);

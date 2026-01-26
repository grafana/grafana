import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    newVizSuggestions: true,
    externalVizSuggestions: true,
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
    test('Should be shown and clickable', async ({ selectors, gotoPanelEditPage }) => {
      // Open dashboard with edit panel
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
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button disabled since panel has not yet changed'
      ).toBeDisabled();

      // apply the suggestion and verify panel options are visible
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

    test('should not apply suggestion if you navigate toggle the viz picker back off', async ({
      selectors,
      gotoPanelEditPage,
    }) => {
      // Open dashboard with edit panel
      const panelEditPage = await gotoPanelEditPage({
        dashboard: {
          uid: 'aBXrJ0R7z',
        },
        id: '9',
      });

      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).locator('.uplot'),
        'time series to be rendered inside panel;'
      ).toBeVisible();

      // Try visualization suggestions
      await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await panelEditPage.getByGrafanaSelector(selectors.components.Tab.title('Suggestions')).click();

      // Verify we see suggestions
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Line chart')),
        'line chart suggestion to be rendered'
      ).toBeVisible();

      // Select a visualization
      await panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();
      await expect(
        panelEditPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.content)
          .getByRole('grid')
          .getByRole('row')
          .first(),
        'table to be rendered inside panel'
      ).toBeVisible();
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton)
      ).toBeDisabled();

      // Verify that toggling the viz picker back cancels the suggestion, restores the line chart, shows panel options
      await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).locator('.uplot'),
        'time series to be rendered inside panel'
      ).toBeVisible();
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.header),
        'options pane to be rendered'
      ).toBeVisible();
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button is still disabled since no changes were applied'
      ).toBeDisabled();
    });

    test('should not apply suggestion if you navigate back to the dashboard', async ({
      page,
      selectors,
      gotoPanelEditPage,
    }) => {
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
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Line chart')),
        'line chart suggestion to be rendered'
      ).toBeVisible();

      // Select a visualization
      await panelEditPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();
      await expect(page.getByRole('grid').getByRole('row').first(), 'table row to be rendered').toBeVisible();
      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton)
      ).toBeDisabled();

      // Verify that navigating back to the dashboard cancels the suggestion and restores the line chart.
      await panelEditPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await expect(
        page.locator('[data-viz-panel-key="panel-9"]').locator('.uplot'),
        'time series to be rendered inside the panel'
      ).toBeVisible();
    });

    test('should not apply suggestion if you navigate back to the dashboard for a new panel', async ({
      page,
      selectors,
      gotoDashboardPage,
    }) => {
      // New dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Press the empty-state Create new panel button
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.AddDashboard.itemButton('Create new panel button'))
        .click();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();

      // Verify we see suggestions on load (after closing the data source picker)
      await page.getByRole('button', { name: 'Close', exact: true }).click({ force: true });
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Line chart')),
        'line chart suggestion to be rendered'
      ).toBeVisible();

      // Select a visualization
      await dashboardPage.getByGrafanaSelector(selectors.components.VisualizationPreview.card('Table')).click();
      await expect(page.getByRole('grid').getByRole('row').first(), 'table row to be rendered').toBeVisible();

      // Verify that navigating back to the dashboard cancels the suggestion and restores the line chart.
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await expect(
        page.locator('[data-viz-panel-key="panel-1"]').getByText('Configure'),
        'configure button is visible in the panel'
      ).toBeVisible();
    });
  }
);

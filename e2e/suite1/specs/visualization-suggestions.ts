import { e2e } from '@grafana/e2e';

const PANEL_UNDER_TEST = 'Lines 500 data points';

e2e.scenario({
  describeName: 'Visualization suggestions',
  itName: 'Should be shown and clickable',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: 'TkZXxlNG3' });
    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit, PANEL_UNDER_TEST);

    // Try visualization suggestions
    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e().contains('Suggestions').click();

    // Verify we see suggestions
    e2e.components.VisualizationPreview.card('Line chart').should('be.visible');

    // Select a visualisation
    e2e.components.VisualizationPreview.card('Table').click();
    e2e.components.Panels.Visualization.Table.header().should('be.visible');
  },
});

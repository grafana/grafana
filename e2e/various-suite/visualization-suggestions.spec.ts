import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Visualization suggestions',
  itName: 'Should be shown and clickable',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: 'aBXrJ0R7z', queryParams: { editPanel: 9 } });

    // Try visualization suggestions
    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e().contains('Suggestions').click();
    cy.wait(3000);

    // Verify we see suggestions
    e2e.components.VisualizationPreview.card('Line chart').should('be.visible');

    // Verify search works
    e2e().get('[placeholder="Search for..."]').type('Table');
    // Should no longer see line chart
    e2e.components.VisualizationPreview.card('Line chart').should('not.exist');

    // Select a visualisation
    e2e.components.VisualizationPreview.card('Table').click();
    e2e.components.Panels.Visualization.Table.header().should('be.visible');
  },
});

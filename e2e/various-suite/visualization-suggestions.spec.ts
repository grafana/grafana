import { e2e } from '../utils';

describe('Visualization suggestions', () => {
  beforeEach(() => {
    e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
  });

  it('Should be shown and clickable', () => {
    e2e.flows.openDashboard({ uid: 'aBXrJ0R7z', queryParams: { editPanel: 9 } });

    // Try visualization suggestions
    e2e.components.PanelEditor.toggleVizPicker().click();
    cy.contains('Suggestions').click();
    cy.wait(3000);

    // Verify we see suggestions
    e2e.components.VisualizationPreview.card('Line chart').should('be.visible');

    // Verify search works
    cy.get('[placeholder="Search for..."]').type('Table');
    // Should no longer see line chart
    e2e.components.VisualizationPreview.card('Line chart').should('not.exist');

    // Select a visualisation
    e2e.components.VisualizationPreview.card('Table').click();
    e2e.components.Panels.Visualization.Table.header().should('be.visible');
  });
});

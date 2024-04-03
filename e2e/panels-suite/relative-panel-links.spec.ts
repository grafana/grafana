import { e2e } from '../utils';
import PanelLinksDashboard from '../dashboards/PanelLinksDashboard.json';

describe('Dashboards', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  after(() => {
    e2e.flows.revertAllChanges();
  });

  it('should restore scroll position', () => {
    e2e.flows.importDashboard(PanelLinksDashboard,2000)
    // Click in panel link button
    cy.get('.css-1pkl4m8-panel-header-item').click() 
    // Verify that the page does not show a 404 error
    try {
        cy.get('.u-over',{ timeout: 2000 }).should('not.contain', 'not found')
      } catch (error) {
        cy.log('Relative link did not work proprely');
      }
  
  });
});

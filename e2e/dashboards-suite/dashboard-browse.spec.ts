import testDashboard from '../dashboards/TestDashboard.json';
import { e2e } from '../utils';

describe('Dashboard browse', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Manage Dashboards tests', () => {
    e2e.flows.importDashboard(testDashboard, 1000, true);

    e2e.pages.Dashboards.visit();

    // Folders and dashboards should be visible
    e2e.pages.BrowseDashboards.table.row('gdev dashboards').should('be.visible');
    e2e.pages.BrowseDashboards.table.row('E2E Test - Import Dashboard').should('be.visible');

    // gdev dashboards folder is collapsed - its content should not be visible
    e2e.pages.BrowseDashboards.table.row('Bar Gauge Demo').should('not.exist');

    // should click a folder and see it's children
    e2e.pages.BrowseDashboards.table.row('gdev dashboards').find('[aria-label^="Expand folder"]').click();
    e2e.pages.BrowseDashboards.table.row('Bar Gauge Demo').should('be.visible');

    // Open the new folder drawer
    cy.contains('button', 'New').click();
    cy.contains('button', 'New folder').click();

    // And create a new folder
    e2e.pages.BrowseDashboards.NewFolderForm.nameInput().type('My new folder');
    e2e.pages.BrowseDashboards.NewFolderForm.form().contains('button', 'Create').click();
    e2e.components.Alert.alertV2('success').find('button[aria-label="Close alert"]').click();
    cy.contains('h1', 'My new folder').should('be.visible');

    // Delete the folder and expect to go back to the root
    cy.contains('button', 'Folder actions').click();
    cy.contains('button', 'Delete').click();
    e2e.flows.confirmDelete();
    cy.contains('h1', 'Dashboards').should('be.visible');

    // Can collapse the gdev folder and delete the dashboard we imported
    e2e.pages.BrowseDashboards.table.row('gdev dashboards').find('[aria-label^="Collapse folder"]').click();
    e2e.pages.BrowseDashboards.table
      .row('E2E Test - Import Dashboard')
      .find('[type="checkbox"]')
      .click({ force: true });

    cy.contains('button', 'Delete').click();
    e2e.flows.confirmDelete();
    e2e.pages.BrowseDashboards.table.row('E2E Test - Import Dashboard').should('not.exist');
  });
});

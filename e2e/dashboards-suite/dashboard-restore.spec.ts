import testDashboard from '../dashboards/TestRestoreDashboard.json';
import { e2e } from '../utils';

describe('Dashboard restore', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Deleted dashboards appear in Recently Deleted', () => {
    e2e.flows.importDashboard(testDashboard, 1000, true);

    e2e.pages.Dashboards.visit();

    // Delete dashboard
    deleteDashboard();

    // Dashboard should appear in Recently Deleted
    e2e.pages.RecentlyDeleted.visit();
    e2e.pages.Search.table.row('E2E Test - Restore Dashboard').should('exist');

    // Restore dashboard
    e2e.pages.Search.table.row('E2E Test - Restore Dashboard').find('[type="checkbox"]').click({ force: true });
    cy.contains('button', 'Restore').click();
    cy.contains('p', 'This action will restore 1 dashboard.').should('be.visible');
    e2e.pages.ConfirmModal.delete().click();
    e2e.components.Alert.alertV2('success').contains('Dashboard E2E Test - Restore Dashboard restored').should('exist');

    // Dashboard should appear in Browse
    e2e.pages.Dashboards.visit();
    e2e.pages.BrowseDashboards.table.row('E2E Test - Restore Dashboard').should('exist');

    // Delete dashboard
    deleteDashboard();

    // Permanently delete dashboard
    e2e.pages.RecentlyDeleted.visit();
    e2e.pages.Search.table.row('E2E Test - Restore Dashboard').find('[type="checkbox"]').click({ force: true });
    cy.contains('button', 'Delete permanently').click();
    cy.contains('p', 'This action will delete 1 dashboard.').should('be.visible');
    e2e.flows.confirmDelete();
    e2e.components.Alert.alertV2('success').contains('Dashboard E2E Test - Restore Dashboard deleted').should('exist');

    // Dashboard should not appear in Recently Deleted or Browse
    e2e.pages.Search.table.row('E2E Test - Restore Dashboard').should('not.exist');

    e2e.pages.Dashboards.visit();
    e2e.pages.BrowseDashboards.table.row('E2E Test - Restore Dashboard').should('not.exist');
  });
});

const deleteDashboard = () => {
  e2e.pages.BrowseDashboards.table.row('E2E Test - Restore Dashboard').find('[type="checkbox"]').click({ force: true });

  cy.contains('button', 'Delete').click();
  e2e.flows.confirmDelete();
  e2e.components.Alert.alertV2('success')
    .contains('Dashboard E2E Test - Restore Dashboard moved to Recently deleted')
    .should('exist');
  e2e.pages.BrowseDashboards.table.row('E2E Test - Restore Dashboard').should('not.exist');
};

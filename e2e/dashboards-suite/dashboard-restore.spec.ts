import testDashboard from '../dashboards/TestRestoreDashboard.json';
import { e2e } from '../utils';

describe('Dashboard restore', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Should delete, restore and permanently delete from the Dashboards page', () => {
    e2e.flows.importDashboard(testDashboard, 1000, true);

    e2e.pages.Dashboards.visit();

    // Delete dashboard
    e2e.pages.BrowseDashboards.table
      .row('E2E Test - Restore Dashboard')
      .find('[type="checkbox"]')
      .click({ force: true });
    deleteDashboard('Delete');

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
    e2e.pages.BrowseDashboards.table
      .row('E2E Test - Restore Dashboard')
      .find('[type="checkbox"]')
      .click({ force: true });
    deleteDashboard('Delete');

    // Permanently delete dashboard
    permanentlyDeleteDashboard();
  });

  it('Should delete, restore and permanently delete from the Dashboard settings', () => {
    e2e.flows.importDashboard(testDashboard, 1000, true);

    e2e.flows.openDashboard({ uid: '355ac6c2-8a12-4469-8b99-4750eb8d0966' });
    e2e.pages.Dashboard.DashNav.settingsButton().click();
    deleteDashboard('Delete dashboard');

    // Permanently delete dashboard
    permanentlyDeleteDashboard();
  });
});

const deleteDashboard = (buttonName: string) => {
  cy.contains('button', buttonName).click();
  e2e.flows.confirmDelete();
  e2e.components.Alert.alertV2('success')
    .contains('Dashboard E2E Test - Restore Dashboard moved to Recently deleted')
    .should('exist');
  e2e.pages.BrowseDashboards.table.row('E2E Test - Restore Dashboard').should('not.exist');
};

const permanentlyDeleteDashboard = () => {
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
};

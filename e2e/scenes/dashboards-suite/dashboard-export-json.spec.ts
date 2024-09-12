import { e2e } from '../utils';

describe('Export as JSON', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Export for internal and external use', () => {
    // Opening a dashboard
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({
      uid: 'ZqZnVvFZz',
      queryParams: { '__feature.scenes': true, '__feature.newDashboardSharingComponent': true },
    });
    cy.wait('@query');

    // Open the export drawer
    e2e.pages.Dashboard.DashNav.NewExportButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsJson().click();

    cy.url().should('include', 'shareView=export');

    // Export as JSON
    e2e.pages.ExportDashboardDrawer.ExportAsJson.container().should('be.visible');
    e2e.pages.ExportDashboardDrawer.ExportAsJson.exportExternallyToggle().should('not.be.checked');
    e2e.pages.ExportDashboardDrawer.ExportAsJson.codeEditor().should('exist');

    e2e.pages.ExportDashboardDrawer.ExportAsJson.saveToFileButton().should('exist');
    e2e.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton().should('exist');
    e2e.pages.ExportDashboardDrawer.ExportAsJson.cancelButton().should('exist');

    // Copy link button should be visible
    e2e.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton()
      .click()
      .then(() => {
        cy.window()
          .then((win) => {
            return win.navigator.clipboard.readText().then((json) => {
              cy.wrap(json).as('url');
            });
          })
          .then(() => {
            cy.get('@url').then((url) => {
              cy.wrap(url).should('not.include', '__inputs');
            });
          });
      });

    e2e.pages.ExportDashboardDrawer.ExportAsJson.exportExternallyToggle().click({ force: true });

    e2e.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton()
      .click()
      .then(() => {
        cy.window()
          .then((win) => {
            return win.navigator.clipboard.readText().then((json) => {
              cy.wrap(json).as('url');
            });
          })
          .then(() => {
            cy.get('@url').then((url) => {
              cy.wrap(url).should('include', '__inputs');
            });
          });
      });

    e2e.pages.ExportDashboardDrawer.ExportAsJson.cancelButton().click();

    cy.url().should('not.include', 'shareView=export');
  });
});

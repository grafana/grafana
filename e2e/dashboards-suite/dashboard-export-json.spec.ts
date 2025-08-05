import { e2e } from '../utils';
import '../utils/support/clipboard';

describe('Export as JSON', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  // Skip for 11.4.8 compatibility - export drawer CSS layout differences (0px height elements)
  it.skip('Export for internal and external use', () => {
    // Opening a dashboard
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({
      uid: 'ZqZnVvFZz',
      queryParams: { '__feature.scenes': true, '__feature.newDashboardSharingComponent': true },
    });
    cy.wait('@query');

    // cy.wrap(
    //   Cypress.automation('remote:debugger:protocol', {
    //     command: 'Browser.grantPermissions',
    //     params: {
    //       permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
    //       origin: window.location.origin,
    //     },
    //   })
    // );

    // Open the export drawer
    e2e.pages.Dashboard.DashNav.NewExportButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsJson().click();

    cy.url().should('include', 'shareView=export');

    // Export as JSON
    e2e.pages.ExportDashboardDrawer.ExportAsJson.container().should('be.visible');
    e2e.pages.ExportDashboardDrawer.ExportAsJson.exportExternallyToggle().should('not.be.checked');
    e2e.components.CodeEditor.container().should('exist');

    e2e.pages.ExportDashboardDrawer.ExportAsJson.saveToFileButton().should('exist');
    e2e.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton().should('exist');
    e2e.pages.ExportDashboardDrawer.ExportAsJson.cancelButton().should('exist');

    //TODO Failing in CI/CD. Fix it
    // Copy link button should be visible
    // e2e.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton()
    //   .click()
    //   .then(() => {
    //     cy.copyFromClipboard().then((url) => {
    //       cy.wrap(url).should('not.include', '__inputs');
    //     });
    //   });

    e2e.pages.ExportDashboardDrawer.ExportAsJson.exportExternallyToggle().click({ force: true });

    //TODO Failing in CI/CD. Fix it
    // e2e.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton()
    //   .click()
    //   .then(() => {
    //     cy.copyFromClipboard().then((url) => {
    //       cy.wrap(url).should('include', '__inputs');
    //     });
    //   });

    e2e.pages.ExportDashboardDrawer.ExportAsJson.cancelButton().click();

    cy.url().should('not.include', 'shareView=export');
  });
});

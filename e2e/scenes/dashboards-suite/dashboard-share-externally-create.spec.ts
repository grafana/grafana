import { e2e } from '../utils';
import '../../utils/support/clipboard';

describe('Shared dashboards', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Close share externally drawer', () => {
    openDashboard();

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareExternally().click();

    cy.url().should('include', 'shareView=public_dashboard');
    e2e.pages.ShareDashboardDrawer.ShareExternally.container().should('be.visible');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.cancelButton().click();

    cy.url().should('not.include', 'shareView=public_dashboard');
    e2e.pages.ShareDashboardDrawer.ShareExternally.container().should('not.exist');
  });

  it('Create a shared dashboard', () => {
    openDashboard();

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareExternally().click();

    // Create button should be disabled
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton().should('be.disabled');

    // Create flow shouldn't show these elements
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableTimeRangeSwitch().should('not.exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableAnnotationsSwitch().should('not.exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton().should('not.exist');

    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.revokeAccessButton().should('not.exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton().should('not.exist');

    // Acknowledge checkbox
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.willBePublicCheckbox()
      .should('be.enabled')
      .click({ force: true });

    // Create shared dashboard
    cy.intercept('POST', '/api/dashboards/uid/edediimbjhdz4b/public-dashboards').as('save');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton().should('be.enabled').click();
    cy.wait('@save');

    // These elements shouldn't be rendered after creating public dashboard
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.willBePublicCheckbox().should('not.exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton().should('not.exist');

    // These elements should be rendered
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableTimeRangeSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableAnnotationsSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.revokeAccessButton().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton().should('exist');
  });

  it('Open a shared dashboard', () => {
    openDashboard();

    cy.wrap(
      Cypress.automation('remote:debugger:protocol', {
        command: 'Browser.grantPermissions',
        params: {
          permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
          origin: window.location.origin,
        },
      })
    );

    // Tag indicating a dashboard is public
    e2e.pages.Dashboard.DashNav.publicDashboardTag().should('exist');

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareExternally().click();

    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableTimeRangeSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableAnnotationsSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.revokeAccessButton().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton().should('exist');

    // Make a request to public dashboards api endpoint without authentication
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton()
      .click()
      .then(() => {
        cy.copyFromClipboard().then((url) => {
          cy.clearCookies()
            .request(getPublicDashboardAPIUrl(String(url)))
            .then((resp) => {
              expect(resp.status).to.eq(200);
            });
        });
      });
  });

  it('Disable a shared dashboard', () => {
    openDashboard();

    cy.wrap(
      Cypress.automation('remote:debugger:protocol', {
        command: 'Browser.grantPermissions',
        params: {
          permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
          origin: window.location.origin,
        },
      })
    );

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareExternally().click();

    // Save public dashboard
    cy.intercept('PATCH', '/api/dashboards/uid/edediimbjhdz4b/public-dashboards/*').as('update');

    // Switch off enabling toggle
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton()
      .should('be.enabled')
      .click({ force: true });
    cy.wait('@update');

    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton().should('be.enabled');

    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton()
      .click()
      .then(() => {
        cy.copyFromClipboard().then((url) => {
          cy.clearCookies()
            .request({ url: getPublicDashboardAPIUrl(String(url)), failOnStatusCode: false })
            .then((resp) => {
              expect(resp.status).to.eq(403);
            });
        });
      });
  });
});

const openDashboard = () => {
  e2e.flows.openDashboard({
    uid: 'edediimbjhdz4b',
    queryParams: { '__feature.scenes': true, '__feature.newDashboardSharingComponent': true },
  });
};
const getPublicDashboardAPIUrl = (url: string): string => {
  let accessToken = url.split('/').pop();
  return `/api/public/dashboards/${accessToken}`;
};

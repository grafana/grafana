import { e2e } from '../utils';

describe('Shared dashboards', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Create a shared dashboard', () => {
    // Opening a dashboard without template variables
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    openDashboard();
    cy.wait('@query');

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareExternally().click();

    // Create button should be disabled
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.createButton().should('be.disabled');

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
    cy.intercept('POST', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards').as('save');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.createButton().should('be.enabled').click();
    cy.wait('@save');

    // These elements shouldn't be rendered after creating public dashboard
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.willBePublicCheckbox().should('not.exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.createButton().should('not.exist');

    // These elements should be rendered
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableTimeRangeSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableAnnotationsSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.revokeAccessButton().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton().should('exist');
  });

  it('Open a shared dashboard', () => {
    // Opening a dashboard without template variables
    cy.intercept({
      method: 'POST',
      pathname: '/api/ds/query',
    }).as('query');
    openDashboard();
    cy.wait('@query');

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
        cy.window().then((win) => {
          win.navigator.clipboard.readText().then((url) => {
            cy.clearCookies()
              .request(getPublicDashboardAPIUrl(String(url)))
              .then((resp) => {
                expect(resp.status).to.eq(200);
              });
          });
        });
      });
  });

  it('Disable a shared dashboard', () => {
    // Opening a dashboard without template variables
    cy.intercept({
      method: 'POST',
      pathname: '/api/ds/query',
    }).as('query');
    openDashboard();
    cy.wait('@query');

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareExternally().click();

    // Save public dashboard
    cy.intercept('PATCH', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards/*').as('update');

    // Switch off enabling toggle
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton()
      .should('be.enabled')
      .click({ force: true });
    cy.wait('@update');

    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton().should('be.enabled');

    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton()
      .click()
      .then(() => {
        cy.window().then((win) => {
          win.navigator.clipboard.readText().then((url) => {
            cy.clearCookies()
              .request({ url: getPublicDashboardAPIUrl(String(url)), failOnStatusCode: false })
              .then((resp) => {
                expect(resp.status).to.eq(403);
              });
          });
        });
      });
  });
});

const openDashboard = () => {
  e2e.flows.openDashboard({
    uid: 'ZqZnVvFZz',
    queryParams: { '__feature.scenes': true, '__feature.newDashboardSharingComponent': true },
  });
};
const getPublicDashboardAPIUrl = (url: string): string => {
  let accessToken = url.split('/').pop();
  return `/api/public/dashboards/${accessToken}`;
};

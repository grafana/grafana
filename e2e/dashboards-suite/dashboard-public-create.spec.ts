import { e2e } from '../utils';

describe('Public dashboards', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Create a public dashboard', () => {
    // Opening a dashboard without template variables
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({ uid: 'ZqZnVvFZz' });
    cy.wait('@query');

    // Open sharing modal
    e2e.pages.ShareDashboardModal.shareButton().click();

    // Select public dashboards tab
    e2e.pages.ShareDashboardModal.PublicDashboard.Tab().click();

    // Create button should be disabled
    e2e.pages.ShareDashboardModal.PublicDashboard.CreateButton().should('be.disabled');

    // Create flow shouldn't show these elements
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.DeleteButton().should('not.exist');

    // Acknowledge checkboxes
    e2e.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox().should('be.enabled').click({ force: true });
    e2e.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox().should('be.enabled').click({ force: true });
    e2e.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox().should('be.enabled').click({ force: true });

    e2e.pages.ShareDashboardModal.PublicDashboard.CreateButton().should('be.enabled');

    // Create public dashboard
    cy.intercept('POST', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards').as('save');
    e2e.pages.ShareDashboardModal.PublicDashboard.CreateButton().click();
    cy.wait('@save');

    // These elements shouldn't be rendered after creating public dashboard
    e2e.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CreateButton().should('not.exist');

    // These elements should be rendered
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.DeleteButton().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown().should('exist');

    e2e.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown().click();
    // There elements should be rendered once the Settings dropdown is opened
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch().should('exist');
  });

  it('Open a public dashboard', () => {
    // Opening a dashboard without template variables
    cy.intercept({
      method: 'POST',
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({ uid: 'ZqZnVvFZz' });
    cy.wait('@query');

    // Tag indicating a dashboard is public
    e2e.pages.Dashboard.DashNav.publicDashboardTag().should('exist');

    // Open sharing modal
    e2e.pages.ShareDashboardModal.shareButton().click();

    // Select public dashboards tab
    cy.intercept('GET', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards').as('query-public-dashboard');
    e2e.pages.ShareDashboardModal.PublicDashboard.Tab().click();
    cy.wait('@query-public-dashboard');

    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.DeleteButton().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown().should('exist');

    e2e.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown().click();
    // There elements should be rendered once the Settings dropdown is opened
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch().should('exist');

    // Make a request to public dashboards api endpoint without authentication
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput()
      .invoke('val')
      .then((url) => {
        cy.clearCookies()
          .request(getPublicDashboardAPIUrl(String(url)))
          .then((resp) => {
            expect(resp.status).to.eq(200);
          });
      });
  });

  it('Disable a public dashboard', () => {
    // Opening a dashboard without template variables
    cy.intercept({
      method: 'POST',
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({ uid: 'ZqZnVvFZz' });
    cy.wait('@query');

    // Open sharing modal
    e2e.pages.ShareDashboardModal.shareButton().click();

    // Select public dashboards tab
    cy.intercept('GET', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards').as('query-public-dashboard');
    e2e.pages.ShareDashboardModal.PublicDashboard.Tab().click();
    cy.wait('@query-public-dashboard');

    // save url before disabling public dashboard
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput()
      .invoke('val')
      .then((text) => cy.wrap(text).as('url'));

    // Save public dashboard
    cy.intercept('PATCH', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards/*').as('update');
    // Switch off enabling toggle
    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('be.enabled').click({ force: true });
    cy.wait('@update');

    // Url should be hidden
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput().should('be.disabled');
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton().should('be.disabled');

    // Make a request to public dashboards api endpoint without authentication
    cy.get('@url').then((url) => {
      cy.clearCookies()
        .request({ url: getPublicDashboardAPIUrl(String(url)), failOnStatusCode: false })
        .then((resp) => {
          expect(resp.status).to.eq(403);
        });
    });
  });
});

const getPublicDashboardAPIUrl = (url: string): string => {
  let accessToken = url.split('/').pop();
  return `/api/public/dashboards/${accessToken}`;
};

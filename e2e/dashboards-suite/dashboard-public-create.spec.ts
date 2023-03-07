import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Create a public dashboard',
  itName: 'Create a public dashboard',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // Opening a dashboard without template variables
    e2e().intercept('POST', '/api/ds/query').as('query');
    e2e.flows.openDashboard({ uid: 'ZqZnVvFZz' });
    e2e().wait('@query');

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
    e2e().intercept('POST', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards').as('save');
    e2e.pages.ShareDashboardModal.PublicDashboard.CreateButton().click();
    e2e().wait('@save');

    // These elements shouldn't be rendered after creating public dashboard
    e2e.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CreateButton().should('not.exist');

    // These elements should be rendered
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.DeleteButton().should('exist');
  },
});

e2e.scenario({
  describeName: 'Open a public dashboard',
  itName: 'Open a public dashboard',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // Opening a dashboard without template variables
    e2e().intercept('POST', '/api/ds/query').as('query');
    e2e.flows.openDashboard({ uid: 'ZqZnVvFZz' });
    e2e().wait('@query');

    // Tag indicating a dashboard is public
    e2e.pages.Dashboard.DashNav.publicDashboardTag().should('exist');

    // Open sharing modal
    e2e.pages.ShareDashboardModal.shareButton().click();

    // Select public dashboards tab
    e2e().intercept('GET', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards').as('query-public-dashboard');
    e2e.pages.ShareDashboardModal.PublicDashboard.Tab().click();
    e2e().wait('@query-public-dashboard');

    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.DeleteButton().should('exist');

    // Make a request to public dashboards api endpoint without authentication
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput()
      .invoke('val')
      .then((url) => {
        e2e()
          .clearCookies()
          .request(getPublicDashboardAPIUrl(String(url)))
          .then((resp) => {
            expect(resp.status).to.eq(200);
          });
      });
  },
});

e2e.scenario({
  describeName: 'Disable a public dashboard',
  itName: 'Disable a public dashboard',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // Opening a dashboard without template variables
    e2e().intercept('/api/ds/query').as('query');
    e2e.flows.openDashboard({ uid: 'ZqZnVvFZz' });
    e2e().wait('@query');

    // Open sharing modal
    e2e.pages.ShareDashboardModal.shareButton().click();

    // Select public dashboards tab
    e2e().intercept('GET', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards').as('query-public-dashboard');
    e2e.pages.ShareDashboardModal.PublicDashboard.Tab().click();
    e2e().wait('@query-public-dashboard');

    // save url before disabling public dashboard
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput()
      .invoke('val')
      .then((text) => e2e().wrap(text).as('url'));

    // Save public dashboard
    e2e().intercept('PUT', '/api/dashboards/uid/ZqZnVvFZz/public-dashboards/*').as('update');
    // Switch off enabling toggle
    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('be.enabled').click({ force: true });
    e2e().wait('@update');

    // Url should be hidden
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput().should('be.disabled');
    e2e.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton().should('be.disabled');

    // Make a request to public dashboards api endpoint without authentication
    e2e()
      .get('@url')
      .then((url) => {
        e2e()
          .clearCookies()
          .request({ url: getPublicDashboardAPIUrl(String(url)), failOnStatusCode: false })
          .then((resp) => {
            expect(resp.status).to.eq(403);
          });
      });
  },
});

const getPublicDashboardAPIUrl = (url: string): string => {
  let accessToken = url.split('/').pop();
  return `/api/public/dashboards/${accessToken}`;
};

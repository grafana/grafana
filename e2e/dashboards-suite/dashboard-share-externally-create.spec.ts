import { PublicDashboard } from '../../public/app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { e2e } from '../utils';
import '../utils/support/clipboard';

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

  // Skipping due to being a flaky test
  // https://drone.grafana.net/grafana/grafana/201217/6/14
  it.skip('Create a shared dashboard and check API', () => {
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
    cy.intercept('POST', '/api/dashboards/uid/edediimbjhdz4b/public-dashboards').as('create');
    e2e.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton().should('be.enabled').click();
    cy.wait('@create')
      .its('response.body')
      .then((body: PublicDashboard) => {
        cy.log(JSON.stringify(body));
        cy.clearCookies()
          .request(getPublicDashboardAPIUrl(body.accessToken))
          .then((resp) => {
            expect(resp.status).to.eq(200);
          });
      });

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

  // Skipping as clipboard permissions are failing in CI. Public dashboard creation is checked in previous test on purpose
  it.skip('Open a shared dashboard', () => {
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

  it.skip('Disable a shared dashboard', () => {
    openDashboard();

    //TODO Failing in CI/CD. Fix it
    // cy.wrap(
    //   Cypress.automation('remote:debugger:protocol', {
    //     command: 'Browser.grantPermissions',
    //     params: {
    //       permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
    //       origin: window.location.origin,
    //     },
    //   })
    // );

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareExternally().click();

    // Save public dashboard
    cy.intercept('PATCH', '/api/dashboards/uid/edediimbjhdz4b/public-dashboards/*').as('update');

    // Switch off enabling toggle
    e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton()
      .should('be.enabled')
      .click({ force: true });

    cy.wait('@update')
      .its('response')
      .then((rs) => {
        expect(rs.statusCode).eq(200);
        const publicDashboard: PublicDashboard = rs.body;
        cy.clearCookies()
          .request({ url: getPublicDashboardAPIUrl(publicDashboard.accessToken), failOnStatusCode: false })
          .then((resp) => {
            expect(resp.status).to.eq(403);
          });
      });
    // .then(() => {
    //   e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton().contains('Resume access');
    //   e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton().should('be.enabled');
    // });

    //TODO Failing in CI/CD. Fix it
    // e2e.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton()
    //   .click()
    //   .then(() => {
    //     cy.copyFromClipboard().then((url) => {
    //       cy.clearCookies()
    //         .request({ url: getPublicDashboardAPIUrl(String(url)), failOnStatusCode: false })
    //         .then((resp) => {
    //           expect(resp.status).to.eq(403);
    //         });
    //     });
    //   });
  });
});

const openDashboard = () => {
  e2e.flows.openDashboard({
    uid: 'edediimbjhdz4b',
    queryParams: { '__feature.scenes': true, '__feature.newDashboardSharingComponent': true },
  });
};

const getPublicDashboardAPIUrl = (accessToken: string): string => {
  return `/api/public/dashboards/${accessToken}`;
};

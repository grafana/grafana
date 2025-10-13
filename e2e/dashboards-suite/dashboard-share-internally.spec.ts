import { ShareLinkConfiguration } from '../../public/app/features/dashboard-scene/sharing/ShareButton/utils';
import { e2e } from '../utils';
import '../utils/support/clipboard';

describe('Share internally', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.removeItem('grafana.dashboard.link.shareConfiguration');
    });
  });

  it('Create a locked time range short link', () => {
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    openDashboard();
    cy.wait('@query');

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

    cy.intercept('POST', '/api/short-urls').as('create');
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareInternally().click();

    cy.url().should('include', 'shareView=link');

    e2e.pages.ShareDashboardDrawer.ShareInternally.lockTimeRangeSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareInternally.shortenUrlSwitch().should('exist');
    e2e.pages.ShareDashboardDrawer.ShareInternally.copyUrlButton().should('exist');
    e2e.components.RadioButton.container().should('have.length', 3);

    cy.window().then((win) => {
      const shareConfiguration = win.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
      expect(shareConfiguration).equal(null);
    });
    cy.wait('@create')
      .its('response')
      .then((rs) => {
        expect(rs.statusCode).eq(200);
        const body: { url: string; uid: string } = rs.body;
        expect(body.url).contain('goto');

        // const url = fromBaseUrl(getShortLinkUrl(body.uid));
        // cy.intercept('GET', url).as('get');
        // cy.visit(url, { retryOnNetworkFailure: true });
        // cy.wait('@get');
        //
        // cy.url().should('not.include', 'from=now-6h&to=now');
      });
  });

  it('Create a relative time range short link', () => {
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    openDashboard();
    cy.wait('@query');

    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();

    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareInternally().click();

    cy.intercept('POST', '/api/short-urls').as('update');
    e2e.pages.ShareDashboardDrawer.ShareInternally.lockTimeRangeSwitch().click({ force: true });

    cy.window().then((win) => {
      const shareConfiguration = win.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
      const { useAbsoluteTimeRange, useShortUrl, theme }: ShareLinkConfiguration = JSON.parse(shareConfiguration);
      expect(useAbsoluteTimeRange).eq(false);
      expect(useShortUrl).eq(true);
      expect(theme).eq('current');
    });

    cy.wait('@update')
      .its('response')
      .then((rs) => {
        expect(rs.statusCode).eq(200);
        const body: { url: string; uid: string } = rs.body;
        expect(body.url).contain('goto');

        // const url = fromBaseUrl(getShortLinkUrl(body.uid));
        // cy.intercept('GET', url).as('get');
        // cy.visit(url, { retryOnNetworkFailure: true });
        // cy.wait('@get');
        //
        // cy.url().should('include', 'from=now-6h&to=now');
      });

    //
    // e2e.pages.ShareDashboardDrawer.ShareInternally.shortenUrlSwitch().click({ force: true });
    //
    // cy.window().then((win) => {
    //   const shareConfiguration = win.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
    //   const { useAbsoluteTimeRange, useShortUrl, theme }: ShareLinkConfiguration = JSON.parse(shareConfiguration);
    //   expect(useAbsoluteTimeRange).eq(true);
    //   expect(useShortUrl).eq(false);
    //   expect(theme).eq('current');
    // });

    // e2e.pages.ShareDashboardDrawer.ShareInternally.copyUrlButton().should('exist');

    // e2e.pages.ShareDashboardDrawer.ShareInternally.copyUrlButton()
    //   .click()
    //   .then(() => {
    //     cy.copyFromClipboard().then((url) => {
    //       cy.wrap(url).should('include', 'from=now-6h&to=now');
    //       cy.wrap(url).should('not.include', 'goto');
    //     });
    //   });
  });

  it('Create a relative time range short link', () => {
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    openDashboard();
    cy.wait('@query');

    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();

    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareInternally().click();

    cy.intercept('POST', '/api/short-urls').as('update');
    e2e.pages.ShareDashboardDrawer.ShareInternally.lockTimeRangeSwitch().click({ force: true });

    cy.window().then((win) => {
      const shareConfiguration = win.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
      const { useAbsoluteTimeRange, useShortUrl, theme }: ShareLinkConfiguration = JSON.parse(shareConfiguration);
      expect(useAbsoluteTimeRange).eq(false);
      expect(useShortUrl).eq(true);
      expect(theme).eq('current');
    });

    cy.wait('@update')
      .its('response')
      .then((rs) => {
        expect(rs.statusCode).eq(200);
        const body: { url: string; uid: string } = rs.body;
        expect(body.url).contain('goto');

        // const url = fromBaseUrl(getShortLinkUrl(body.uid));
        // cy.intercept('GET', url).as('get');
        // cy.visit(url, { retryOnNetworkFailure: true });
        // cy.wait('@get');
        //
        // cy.url().should('include', 'from=now-6h&to=now');
      });
  });

  //TODO Failing in CI/CD. Fix it
  it.skip('Share button gets configured link', () => {
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    openDashboard();
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

    //TODO Failing in CI/CD. Fix it
    // e2e.pages.Dashboard.DashNav.newShareButton
    //   .shareLink()
    //   .click()
    //   .then(() => {
    //     cy.window()
    //       .then((win) => {
    //         return win.navigator.clipboard.readText().then((url) => {
    //           cy.wrap(url).as('url');
    //         });
    //       })
    //       .then(() => {
    //         cy.get('@url').then((url) => {
    //           cy.wrap(url).should('not.include', 'from=now-6h&to=now');
    //           cy.wrap(url).should('include', 'goto');
    //         });
    //       });
    //   });

    // Open share externally drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareInternally().click();

    cy.window().then((win) => {
      const shareConfiguration = win.localStorage.getItem('grafana.dashboard.link.shareConfiguration');
      expect(shareConfiguration).equal(null);
    });

    e2e.pages.ShareDashboardDrawer.ShareInternally.shortenUrlSwitch().click({ force: true });
    e2e.pages.ShareDashboardDrawer.ShareInternally.lockTimeRangeSwitch().click({ force: true });

    e2e.components.Drawer.General.close().click();

    cy.url().should('not.include', 'shareView=link');

    //TODO Failing in CI/CD. Fix it
    // e2e.pages.Dashboard.DashNav.newShareButton
    //   .shareLink()
    //   .click()
    //   .then(() => {
    //     cy.window()
    //       .then((win) => {
    //         return win.navigator.clipboard.readText().then((url) => {
    //           cy.wrap(url).as('url');
    //         });
    //       })
    //       .then(() => {
    //         cy.get('@url').then((url) => {
    //           cy.wrap(url).should('include', 'from=now-6h&to=now');
    //           cy.wrap(url).should('not.include', 'goto');
    //         });
    //       });
    //   });
  });
});

const openDashboard = () => {
  e2e.flows.openDashboard({
    uid: 'ZqZnVvFZz',
    queryParams: { '__feature.scenes': true, '__feature.newDashboardSharingComponent': true },
    timeRange: { from: 'now-6h', to: 'now' },
  });
};

// const getShortLinkUrl = (uid: string): string => {
//   return `/goto/${uid}`;
// };

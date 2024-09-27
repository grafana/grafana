import { SnapshotCreateResponse } from '../../public/app/features/dashboard/services/SnapshotSrv';
import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';
import '../utils/support/clipboard';

describe('Snapshots', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Create a snapshot dashboard', () => {
    // Opening a dashboard
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({
      uid: 'ZqZnVvFZz',
      queryParams: { '__feature.scenes': true, '__feature.newDashboardSharingComponent': true },
    });
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

    const panelsToCheck = [
      'Raw Data Graph',
      'Last non-null',
      'min',
      'Max',
      'The data from graph above with seriesToColumns transform',
    ];

    // Open the sharing drawer
    e2e.pages.Dashboard.DashNav.newShareButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.newShareButton.menu.shareSnapshot().click();

    // Publish snapshot
    cy.intercept('POST', '/api/snapshots').as('create');
    e2e.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot().click();
    cy.wait('@create')
      .its('response')
      .then((rs) => {
        expect(rs.statusCode).eq(200);
        const body: SnapshotCreateResponse = rs.body;
        cy.visit(fromBaseUrl(getSnapshotUrl(body.key)));

        // Validate the dashboard controls are rendered
        e2e.pages.Dashboard.Controls().should('exist');

        // Validate the panels are rendered
        for (const title of panelsToCheck) {
          e2e.components.Panels.Panel.title(title).should('be.visible');
        }
      });

    // Copy link button should be visible
    // e2e.pages.ShareDashboardDrawer.ShareSnapshot.copyUrlButton().should('exist');

    //TODO Failing in CI/CD. Fix it
    // Copy the snapshot URL form the clipboard and open the snapshot
    // e2e.pages.ShareDashboardDrawer.ShareSnapshot.copyUrlButton()
    //   .click()
    //   .then(() => {
    //     cy.copyFromClipboard().then((url) => {
    //       cy.wrap(url).as('url');
    //     });
    //   })
    //   .then(() => {
    //     cy.get('@url').then((url) => {
    //       e2e.pages.ShareDashboardDrawer.ShareSnapshot.visit(getSnapshotKey(String(url)));
    //     });
    //
    //     // Validate the dashboard controls are rendered
    //     e2e.pages.Dashboard.Controls().should('exist');
    //
    //     // Validate the panels are rendered
    //     for (const title of panelsToCheck) {
    //       e2e.components.Panels.Panel.title(title).should('be.visible');
    //     }
    //   });
  });
});

const getSnapshotUrl = (uid: string): string => {
  return `/dashboard/snapshot/${uid}`;
};

// const getSnapshotKey = (url: string): string => {
//   return url.split('/').pop();
// };

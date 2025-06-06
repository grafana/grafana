import { e2e } from '../utils';

describe('Snapshots', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Create a snapshot dashboard', () => {
    // Opening a dashboard
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({ uid: 'ZqZnVvFZz', queryParams: { '__feature.newDashboardSharingComponent': false } });
    cy.wait('@query');

    const panelsToCheck = [
      'Raw Data Graph',
      'Last non-null',
      'min',
      'Max',
      'The data from graph above with seriesToColumns transform',
    ];

    // Open the sharing modal
    e2e.components.NavToolbar.shareDashboard().click();

    // Select the snapshot tab
    e2e.components.Tab.title('Snapshot').click();

    // Publish snapshot
    cy.intercept('POST', '/api/snapshots').as('save');
    e2e.pages.ShareDashboardModal.SnapshotScene.PublishSnapshot().click();
    cy.wait('@save');

    // Copy link button should be visible
    e2e.pages.ShareDashboardModal.SnapshotScene.CopyUrlButton().should('exist');

    // Copy the snapshot URL form the input and open the snapshot
    e2e.pages.ShareDashboardModal.SnapshotScene.CopyUrlInput()
      .invoke('val')
      .then((text) => cy.wrap(text).as('url'));

    // Open the snapshot using the new URL
    cy.get('@url').then((url) => {
      e2e.pages.ShareDashboardModal.SnapshotScene.visit(getSnapshotKey(String(url)));
    });

    // Validate the dashboard controls are rendered
    e2e.pages.Dashboard.Controls().should('exist');

    // Validate the panels are rendered
    for (const title of panelsToCheck) {
      e2e.components.Panels.Panel.title(title).should('be.visible');
    }
  });
});
//
const getSnapshotKey = (url: string): string => {
  return url.split('/').pop();
};

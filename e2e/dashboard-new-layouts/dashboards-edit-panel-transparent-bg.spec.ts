import { e2e } from '../utils';

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

describe('Dashboard', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can toggle transparent background switch', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    e2e.flows.scenes.selectPanel(/^No Data Points Warning$/);

    e2e.components.Panels.Panel.title('No Data Points Warning').then((el) => {
      cy.wrap(el.css('background')).should('not.match', /rgba\(0, 0, 0, 0\)/);
    });

    cy.get('#transparent-background').click({ force: true });
    e2e.components.Panels.Panel.title('No Data Points Warning').then((el) => {
      cy.wrap(el.css('background')).should('match', /rgba\(0, 0, 0, 0\)/);
    });
  });
});

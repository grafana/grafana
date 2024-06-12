import { e2e } from '../utils';

describe('Gauge Panel', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Gauge rendering e2e tests', () => {
    // open Panel Tests - Gauge
    e2e.flows.openDashboard({ uid: '_5rDmaQiz' });

    // check that gauges are rendered
    cy.get('body').find(`.flot-base`).should('have.length', 16);

    // check that no panel errors exist
    e2e.components.Panels.Panel.headerCornerInfo('error').should('not.exist');
  });
});

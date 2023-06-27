import { e2e } from '@grafana/e2e';

import panelSandboxDashboard from './panelSandboxDashboard.json';

const DASHBOARD_ID = 'c46b2460-16b7-42a5-82d1-b07fbf431950';

describe('Panel sandbox', () => {
  beforeEach(() => e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'), true));

  describe('Sandbox disabled', () => {
    const queryParams = { '__feature.pluginsFrontendSandbox': false };

    it('Add iframe to body', () => {
      e2e.flows.importDashboard(panelSandboxDashboard, 1000, true);
      e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams });

      cy.get('[data-testid="panel-button-1"]').click();

      cy.get('#createElementIframe').should('exist');
      cy.get('#innerHTMLIframe').should('exist');
      cy.get('#adjacentIframe').should('exist');
    });
  });

  afterEach(() => e2e.flows.revertAllChanges());
  after(() => e2e().clearCookies());
});

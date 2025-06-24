import { GrafanaBootConfig } from '@grafana/runtime';

import { e2e } from '../utils';

describe('Panels smokescreen', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), false);
  });

  after(() => {
    e2e.flows.revertAllChanges();
  });

  it('Tests each panel type in the panel edit view to ensure no crash', () => {
    e2e.flows.addDashboard();

    e2e.pages.Dashboard.DashNav.shareButton().should('be.visible');

    e2e.flows.addPanel({
      dataSourceName: 'gdev-testdata',
      timeout: 10000,
      visitDashboardAtStart: false,
    });

    cy.window().then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
      // Loop through every panel type and ensure no crash
      Object.entries(win.grafanaBootData.settings.panels).forEach(([_, panel]) => {
        // TODO: Remove Flame Graph check as part of addressing #66803
        if (!panel.hideFromList && panel.state !== 'deprecated') {
          e2e.components.PanelEditor.toggleVizPicker().click();
          e2e.components.PluginVisualization.item(panel.name).scrollIntoView().should('be.visible').click();

          e2e.components.PanelEditor.toggleVizPicker().should((e) => expect(e).to.contain(panel.name));
          // TODO: Come up with better check / better failure messaging to clearly indicate which panel failed
          cy.contains('An unexpected error happened').should('not.exist');
        }
      });
    });
  });
});

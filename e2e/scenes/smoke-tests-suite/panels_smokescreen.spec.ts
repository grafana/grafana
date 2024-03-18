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

    e2e.flows.addPanel({
      dataSourceName: 'gdev-testdata',
      timeout: 10000,
    });
    // // TODO: Try and use e2e.flows.addPanel() instead of block below
    // try {
    //   e2e.pages.AddDashboard.itemButton('Create new panel button').should('be.visible');
    //   e2e.pages.AddDashboard.itemButton('Create new panel button').click();
    //   // e2e.components.PageToolbar.itemButton('Add button').should('be.visible');
    //   // e2e.components.PageToolbar.itemButton('Add button').click();
    // } catch (e) {
    //   // Depending on the screen size, the "Add panel" button might be hidden
    //   e2e.components.PageToolbar.item('Show more items').click();
    //   e2e.components.PageToolbar.item('Add button').last().click();
    // }
    // // e2e.pages.AddDashboard.itemButton('Add new visualization menu item').should('be.visible');
    // // e2e.pages.AddDashboard.itemButton('Add new visualization menu item').click();
    //
    // e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
    //   .should('be.visible')
    //   .within(() => {
    //     cy.get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
    //   });

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

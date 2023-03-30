import { e2e } from '@grafana/e2e';

const PANEL_UNDER_TEST = 'Value reducers 1';

e2e.scenario({
  describeName: 'Panel edit tests',
  itName: 'Tests various Panel edit scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e().intercept('/api/ds/query').as('query');
    e2e.flows.openDashboard({ uid: 'wfTJJL5Wz' });
    e2e().wait('@query');

    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit, PANEL_UNDER_TEST);

    // New panel editor opens when navigating from Panel menu
    e2e.components.PanelEditor.General.content().should('be.visible');

    // Queries tab is rendered and open by default
    e2e.components.PanelEditor.DataPane.content()
      .should('be.visible')
      .within(() => {
        e2e.components.Tab.title('Query').should('be.visible');
        // data should be the active tab
        e2e.components.Tab.active().within((li: JQuery<HTMLLIElement>) => {
          expect(li.text()).equals('Query1'); // there's already a query so therefore Query + 1
        });
        e2e.components.QueryTab.content().should('be.visible');
        e2e.components.TransformTab.content().should('not.exist');
        e2e.components.AlertTab.content().should('not.exist');
        e2e.components.PanelAlertTabContent.content().should('not.exist');

        //  Bottom pane tabs
        //  Can change to Transform tab
        e2e.components.Tab.title('Transform').should('be.visible').click();
        e2e.components.Tab.active().within((li: JQuery<HTMLLIElement>) => {
          expect(li.text()).equals('Transform0'); // there's no transform so therefore Transform + 0
        });
        e2e.components.Transforms.card('Merge').scrollIntoView().should('be.visible');
        e2e.components.QueryTab.content().should('not.exist');
        e2e.components.AlertTab.content().should('not.exist');
        e2e.components.PanelAlertTabContent.content().should('not.exist');

        //  Can change to Alerts tab (graph panel is the default vis so the alerts tab should be rendered)
        e2e.components.Tab.title('Alert').should('be.visible').click();
        e2e.components.Tab.active().should('have.text', 'Alert0'); // there's no alert so therefore Alert + 0

        // Needs to be disabled until Grafana EE turns unified alerting on by default
        // e2e.components.AlertTab.content().should('not.exist');

        e2e.components.QueryTab.content().should('not.exist');
        e2e.components.TransformTab.content().should('not.exist');

        // Needs to be disabled until Grafana EE turns unified alerting on by default
        // e2e.components.PanelAlertTabContent.content().should('exist');
        // e2e.components.PanelAlertTabContent.content().should('be.visible');

        e2e.components.Tab.title('Query').should('be.visible').click();
      });

    // Panel sidebar is rendered open by default
    e2e.components.PanelEditor.OptionsPane.content().should('be.visible');

    // close options pane
    e2e.components.PanelEditor.toggleVizOptions().click();
    e2e.components.PanelEditor.OptionsPane.content().should('not.exist');

    e2e().wait(100);

    // open options pane
    e2e.components.PanelEditor.toggleVizOptions().should('be.visible').click();
    e2e.components.PanelEditor.OptionsPane.content().should('be.visible');

    // Check that Time series is chosen
    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e.components.PluginVisualization.item('Time series').should('be.visible');
    e2e.components.PluginVisualization.current().should((e) => expect(e).to.contain('Time series'));

    // Check that table view works
    e2e.components.PanelEditor.toggleTableView().click({ force: true });
    e2e.components.Panels.Visualization.Table.header()
      .should('be.visible')
      .within(() => {
        cy.contains('A-series').should('be.visible');
      });

    // Change to Text panel
    e2e.components.PluginVisualization.item('Text').scrollIntoView().should('be.visible').click();
    e2e.components.PanelEditor.toggleVizPicker().should((e) => expect(e).to.contain('Text'));

    // Data pane should not be rendered
    e2e.components.PanelEditor.DataPane.content().should('not.exist');

    // Change to Table panel
    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e.components.PluginVisualization.item('Table').scrollIntoView().should('be.visible').click();
    e2e.components.PanelEditor.toggleVizPicker().should((e) => expect(e).to.contain('Table'));

    // Data pane should be rendered
    e2e.components.PanelEditor.DataPane.content().should('be.visible');

    // Field & Overrides tabs (need to switch to React based vis, i.e. Table)
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Table Show table header').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Table Column width').should('be.visible');
  },
});

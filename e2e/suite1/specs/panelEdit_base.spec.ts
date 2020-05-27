import { e2e } from '@grafana/e2e';

const PANEL_UNDER_TEST = 'Random walk series';

e2e.scenario({
  describeName: 'Panel edit tests',
  itName: 'Testes various Panel edit scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard('5SdHCadmz');

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
        e2e.components.TransformTab.content().should('not.be.visible');
        e2e.components.AlertTab.content().should('not.be.visible');

        //  Bottom pane tabs
        //  Can change to Transform tab
        e2e.components.Tab.title('Transform')
          .should('be.visible')
          .click();
        e2e.components.Tab.active().within((li: JQuery<HTMLLIElement>) => {
          expect(li.text()).equals('Transform0'); // there's no transform so therefore Transform + 0
        });
        e2e.components.TransformTab.content().should('be.visible');
        e2e.components.QueryTab.content().should('not.be.visible');
        e2e.components.AlertTab.content().should('not.be.visible');

        //  Can change to Alerts tab (graph panel is the default vis so the alerts tab should be rendered)
        e2e.components.Tab.title('Alert')
          .should('be.visible')
          .click();
        e2e.components.Tab.active().within((li: JQuery<HTMLLIElement>) => {
          expect(li.text()).equals('Alert0'); // there's no alert so therefore Alert + 0
        });
        e2e.components.AlertTab.content().should('be.visible');
        e2e.components.QueryTab.content().should('not.be.visible');
        e2e.components.TransformTab.content().should('not.be.visible');

        e2e.components.Tab.title('Query')
          .should('be.visible')
          .click();
      });

    // Panel sidebar is rendered open by default
    e2e.components.PanelEditor.OptionsPane.content().should('be.visible');

    // Can toggle on/off sidebar
    e2e.components.PanelEditor.OptionsPane.close().should('be.visible');
    e2e.components.PanelEditor.OptionsPane.open().should('not.be.visible');

    // close options pane
    e2e.components.PanelEditor.OptionsPane.close().click();
    e2e.components.PanelEditor.OptionsPane.open().should('be.visible');
    e2e.components.PanelEditor.OptionsPane.close().should('not.be.visible');
    e2e.components.PanelEditor.OptionsPane.content().should('not.be.visible');

    // open options pane
    e2e.components.PanelEditor.OptionsPane.open().click();
    e2e.components.PanelEditor.OptionsPane.close().should('be.visible');
    e2e.components.PanelEditor.OptionsPane.open().should('not.be.visible');
    e2e.components.PanelEditor.OptionsPane.content().should('be.visible');

    // Can change visualisation type
    e2e.components.OptionsGroup.toggle('Panel type')
      .should('be.visible')
      .click();

    // Check that Graph is chosen
    e2e.components.PluginVisualization.item('Graph').should('be.visible');
    e2e.components.PluginVisualization.current().within((div: JQuery<HTMLDivElement>) => {
      expect(div.text()).equals('Graph');
    });

    // Change to Text panel
    e2e.components.PluginVisualization.item('Text')
      .scrollIntoView()
      .should('be.visible')
      .click();
    e2e.components.PluginVisualization.current().within((div: JQuery<HTMLDivElement>) => {
      expect(div.text()).equals('Text');
    });

    // Data pane should not be rendered
    e2e.components.PanelEditor.DataPane.content().should('not.be.visible');

    // Change to Table panel
    e2e.components.PluginVisualization.item('Table')
      .scrollIntoView()
      .should('be.visible')
      .click();
    e2e.components.PluginVisualization.current().within((div: JQuery<HTMLDivElement>) => {
      expect(div.text()).equals('Table');
    });

    // Data pane should be rendered
    e2e.components.PanelEditor.DataPane.content().should('be.visible');

    // Field & Overrides tabs (need to switch to React based vis, i.e. Table)
    e2e.components.PanelEditor.OptionsPane.tab('Field').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.tab('Overrides').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.tab('Field').click();

    e2e.components.FieldConfigEditor.content().should('be.visible');
    e2e.components.OverridesConfigEditor.content().should('not.be.visible');

    e2e.components.PanelEditor.OptionsPane.tab('Field').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.tab('Overrides')
      .should('be.visible')
      .click();

    e2e.components.OverridesConfigEditor.content().should('be.visible');
    e2e.components.FieldConfigEditor.content().should('not.be.visible');
  },
});

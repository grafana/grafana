import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Panel edit panels smokescreen',
  itName: 'Tests each panel type in the panel edit view to ensure no crash',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.addDashboard();

    // TODO: Try and use e2e.flows.addPanel() instead of block below
    try {
      e2e.components.PageToolbar.itemButton('Add panel button').should('be.visible');
      e2e.components.PageToolbar.itemButton('Add panel button').click();
    } catch (e) {
      // Depending on the screen size, the "Add panel" button might be hidden
      e2e.components.PageToolbar.item('Show more items').click();
      e2e.components.PageToolbar.item('Add panel button').last().click();
    }
    e2e.pages.AddDashboard.itemButton('Add new visualization menu item').should('be.visible');
    e2e.pages.AddDashboard.itemButton('Add new visualization menu item').click();

    // Loop through every panel type and ensure no crash
    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e.components.PluginVisualization.item('Table').scrollIntoView().should('be.visible').click();
    e2e.components.PanelEditor.toggleVizPicker().should((e) => expect(e).to.contain('Table'));

    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e.components.PluginVisualization.item('Stat').scrollIntoView().should('be.visible').click();
    e2e.components.PanelEditor.toggleVizPicker().should((e) => expect(e).to.contain('Stat'));

    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e.components.PluginVisualization.item('Gauge').scrollIntoView().should('be.visible').click();
    e2e.components.PanelEditor.toggleVizPicker().should((e) => expect(e).to.contain('Gauge'));

    e2e.components.PanelEditor.toggleVizPicker().click();
    e2e.components.PluginVisualization.item('Geomap').scrollIntoView().should('be.visible').click();
    e2e.components.PanelEditor.toggleVizPicker().should((e) => expect(e).to.contain('Geomap'));
  },
});

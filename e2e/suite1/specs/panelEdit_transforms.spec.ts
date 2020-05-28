import { e2e } from '@grafana/e2e';

const PANEL_UNDER_TEST = 'Random walk series';

e2e.scenario({
  describeName: 'Panel edit tests - transformations',
  itName: 'Tests transformations editor',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard('5SdHCadmz');

    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit, PANEL_UNDER_TEST);

    e2e.components.Tab.title('Transform')
      .should('be.visible')
      .click();

    e2e.components.TransformTab.newTransform('Reduce')
      .should('be.visible')
      .click();

    e2e.components.Transforms.Reduce.calculationsLabel().should('be.visible');
  },
});

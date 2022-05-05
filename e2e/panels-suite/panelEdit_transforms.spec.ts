import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Panel edit tests - transformations',
  itName: 'Tests transformations editor',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: '5SdHCadmz', queryParams: { editPanel: 3 } });

    e2e.components.Tab.title('Transform').should('be.visible').click();

    e2e.components.TransformTab.newTransform('Reduce').scrollIntoView().should('be.visible').click();

    e2e.components.Transforms.Reduce.calculationsLabel().should('be.visible');
  },
});

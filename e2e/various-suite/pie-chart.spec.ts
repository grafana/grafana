import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../utils';

e2e.scenario({
  describeName: 'Pie Chart Panel',
  itName: 'Pie Chart rendering e2e tests',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // open Panel Tests - Pie Chart
    e2e.flows.openDashboard({ uid: 'lVE-2YFMz' });

    cy.get(`[data-panelid=11] [aria-label^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"]`).should(
      'have.length',
      5
    );
  },
});

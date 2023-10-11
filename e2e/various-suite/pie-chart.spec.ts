import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../utils';

describe('Pie Chart Panel', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Pie Chart rendering e2e tests', () => {
    // open Panel Tests - Pie Chart
    e2e.flows.openDashboard({ uid: 'lVE-2YFMz' });

    cy.get(`[data-panelid=11] [aria-label^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"]`).should(
      'have.length',
      5
    );
  });
});

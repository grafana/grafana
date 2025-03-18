import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Embedded dashboard', function () {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('open test page', function () {
    cy.visit(fromBaseUrl('/dashboards/embedding-test'));

    // Verify pie charts are rendered
    cy.get(
      `[data-viz-panel-key="panel-11"] [data-testid^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"]`
    ).should('have.length', 5);

    // Verify no url sync
    e2e.components.TimePicker.openButton().click();
    cy.get('label:contains("Last 1 hour")').click();
    cy.url().should('eq', fromBaseUrl('/dashboards/embedding-test'));
  });
});

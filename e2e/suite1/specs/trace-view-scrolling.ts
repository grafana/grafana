import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Trace view',
  itName: 'Can lazy load big traces',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e().intercept('GET', '/api/datasources/proxy/29/api/traces/long-trace', {
      fixture: 'long-trace-response.json',
    });

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').click();

        e2e().contains('gdev-jaeger').scrollIntoView().should('be.visible').click();
      });

    e2e.components.QueryField.container().should('be.visible').type('long-trace');

    e2e.components.RefreshPicker.runButton().should('be.visible').click();

    e2e().get('[data-test-id="SpanBar--wrapper"]').should('have.length', 100);
    e2e().get('.scrollbar-view').scrollTo('center');

    // After scrolling we should have 140 spans instead of the first 100
    e2e().get('[data-test-id="SpanBar--wrapper"]').should('have.length', 140);
  },
});

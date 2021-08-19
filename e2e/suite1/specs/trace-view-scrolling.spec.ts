import { e2e } from '@grafana/e2e';

describe('Trace view', () => {
  it('Can lazy load big traces', () => {
    e2e.flows.login('admin', 'admin');
    e2e()
      .intercept('GET', '**/api/traces/long-trace', {
        fixture: 'long-trace-response.json',
      })
      .as('longTrace');

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').click();
      });

    e2e().contains('gdev-jaeger').scrollIntoView().should('be.visible').click();

    e2e.components.DataSource.Jaeger.traceIDInput().should('be.visible').type('long-trace');

    e2e.components.RefreshPicker.runButton().should('be.visible').click();

    e2e().wait('@longTrace');

    e2e.components.TraceViewer.spanBar().should('have.length', 100);

    e2e.pages.Explore.General.scrollBar().scrollTo('center');

    // After scrolling we should load more spans
    e2e.components.TraceViewer.spanBar().should('have.length', 140);
  });
});

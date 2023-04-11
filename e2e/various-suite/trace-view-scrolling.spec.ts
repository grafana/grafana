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

    e2e.components.DataSourcePicker.container().should('be.visible').type('gdev-jaeger{enter}');

    e2e.components.QueryField.container().should('be.visible').type('long-trace');

    e2e().wait(500);

    e2e.components.RefreshPicker.runButtonV2().should('be.visible').click();

    e2e().wait('@longTrace');

    e2e.components.TraceViewer.spanBar().should('be.visible');

    e2e.components.TraceViewer.spanBar()
      .its('length')
      .then((oldLength) => {
        e2e.pages.Explore.General.scrollView().children('.scrollbar-view').scrollTo('center');

        // After scrolling we should load more spans
        e2e.components.TraceViewer.spanBar().should(($span) => {
          expect($span.length).to.be.gt(oldLength);
        });
      });
  });
});

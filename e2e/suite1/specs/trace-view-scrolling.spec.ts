import { e2e } from '@grafana/e2e';
import { response } from '../../mocks/long-trace-response';

describe('Trace view', () => {
  it('Can lazy load big traces', () => {
    e2e.flows.login('admin', 'admin');
    e2e().on('uncaught:exception', (err, runnable) => {
      // returning false here prevents Cypress from
      // failing the test
      return false;
    });
    e2e().intercept('/api/traces/long-trace', response).as('longTrace');

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').click();

        e2e().contains('gdev-jaeger').scrollIntoView().should('be.visible').click();
      });

    e2e.components.QueryField.container().should('be.visible').type('long-trace');

    e2e.components.RefreshPicker.runButton().should('be.visible').click();

    e2e().wait('@longTrace');

    e2e()
      .get('details')
      .should('be.visible')
      .then(function ($input) {
        $input[0].setAttribute('open', 'true');
      })
      .screenshot();

    // e2e()
    //   .get(selectors.components.TraceViewer.spanBar(), { timeout: 50000 })
    //   .should('be.visible')
    //   .and('have.length', 100);

    // e2e.pages.Explore.General.scrollBar().scrollTo('center');

    // // After scrolling we should have 140 spans instead of the first 100
    // e2e.components.TraceViewer.spanBar().should('have.length', 140);
  });
});

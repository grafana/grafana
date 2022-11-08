import { e2e } from '@grafana/e2e';

const dataSourceName = 'LokiEditor';
const addDataSource = () => {
  e2e.flows.addDataSource({
    type: 'Loki',
    expectedAlertMessage:
      'Unable to fetch labels from Loki (Failed to call resource), please check the server logs for more details',
    name: dataSourceName,
    form: () => {
      e2e.components.DataSource.DataSourceHttpSettings.urlInput().type('http://loki-url:3100');
    },
  });
};

e2e.scenario({
  describeName: 'Loki Query Editor',
  itName: 'Autocomplete features should work as expected.',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    addDataSource();

    e2e().intercept(/labels?/, (req) => {
      req.reply({ status: 'success', data: ['instance', 'job', 'source'] });
    });

    e2e().intercept(/series?/, (req) => {
      req.reply({ status: 'success', data: [{ instance: 'instance1' }] });
    });

    // Go to Explore and choose Loki data source
    e2e.pages.Explore.visit();
    e2e.components.DataSourcePicker.container().should('be.visible').click();
    e2e().contains(dataSourceName).scrollIntoView().should('be.visible').click();

    cy.contains('label', 'Code').click();

    // we need to wait for the query-field being lazy-loaded, in two steps:
    // it is a two-step process:
    // 1. first we wait for the text 'Loading...' to appear
    // 1. then we wait for the text 'Loading...' to disappear
    const monacoLoadingText = 'Loading...';
    const queryText = `rate(http_requests_total{job="grafana"}[5m])`;
    e2e.components.QueryField.container().should('be.visible').should('have.text', monacoLoadingText);
    e2e.components.QueryField.container().should('be.visible').should('not.have.text', monacoLoadingText);
    e2e.components.QueryField.container().type(queryText, { parseSpecialCharSequences: false }).type('{backspace}');

    cy.contains(queryText.slice(0, -1)).should('be.visible');

    e2e.components.QueryField.container().type(e2e.typings.undo());

    cy.contains(queryText).should('be.visible');
  },
});

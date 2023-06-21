import { e2e } from '@grafana/e2e';

const dataSourceName = 'LokiEditor';
const addDataSource = () => {
  e2e.flows.addDataSource({
    type: 'Loki',
    expectedAlertMessage:
      'Unable to connect with Loki (Failed to call resource). Please check the server logs for more details.',
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

    e2e().contains('Code').click();

    // Wait for lazy loading
    const monacoLoadingText = 'Loading...';

    e2e.components.QueryField.container().should('be.visible').should('have.text', monacoLoadingText);
    e2e.components.QueryField.container().should('be.visible').should('not.have.text', monacoLoadingText);

    // adds closing braces around empty value
    e2e.components.QueryField.container().type('time(');
    e2e()
      .get('.monaco-editor textarea:first')
      .should(($el) => {
        expect($el.val()).to.eq('time()');
      });

    // removes closing brace when opening brace is removed
    e2e.components.QueryField.container().type('{selectall}{backspace}avg_over_time({backspace}');
    e2e()
      .get('.monaco-editor textarea:first')
      .should(($el) => {
        expect($el.val()).to.eq('avg_over_time');
      });

    // keeps closing brace when opening brace is removed and inner values exist
    e2e.components.QueryField.container().type(
      '{selectall}{backspace}time(test{leftArrow}{leftArrow}{leftArrow}{leftArrow}{backspace}'
    );
    e2e()
      .get('.monaco-editor textarea:first')
      .should(($el) => {
        expect($el.val()).to.eq('timetest)');
      });

    // overrides an automatically inserted brace
    e2e.components.QueryField.container().type('{selectall}{backspace}time()');
    e2e()
      .get('.monaco-editor textarea:first')
      .should(($el) => {
        expect($el.val()).to.eq('time()');
      });

    // does not override manually inserted braces
    e2e.components.QueryField.container().type('{selectall}{backspace}))');
    e2e()
      .get('.monaco-editor textarea:first')
      .should(($el) => {
        expect($el.val()).to.eq('))');
      });

    /** Runner plugin */

    // Should execute the query when enter with shift is pressed
    e2e.components.QueryField.container().type('{selectall}{backspace}{shift+enter}');
    e2e().get('[data-testid="explore-no-data"]').should('be.visible');

    /** Suggestions plugin */
    e2e.components.QueryField.container().type('{selectall}av');
    e2e().contains('avg').should('be.visible');
    e2e().contains('avg_over_time').should('be.visible');
  },
});

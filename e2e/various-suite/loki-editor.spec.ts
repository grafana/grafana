import { e2e } from '@grafana/e2e';

const dataSourceName = 'LokiSlate';
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

describe('Loki Editor', () => {
  beforeEach(() => {
    e2e.flows.login('admin', 'admin');

    e2e()
      .request({ url: `${e2e.env('BASE_URL')}/api/datasources/name/${dataSourceName}`, failOnStatusCode: false })
      .then((response) => {
        if (response.isOkStatusCode) {
          return;
        }
        addDataSource();
      });
  });

  it('Braces plugin should insert closing brace', () => {
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

    // adds closing braces around empty value
    e2e().contains('Code').click();
    const queryField = e2e().get('[role="code"]');
    const queryFieldValue = e2e().get('.monaco-editor textarea:first');
    queryField.type('time(');
    queryFieldValue.should(($el) => {
      expect($el.val()).to.eq('time()');
    });

    // removes closing brace when opening brace is removed
    queryField.type('{backspace}');
    queryFieldValue.should(($el) => {
      expect($el.val()).to.eq('time');
    });

    // keeps closing brace when opening brace is removed and inner values exist
    queryField.type(`{selectall}{backspace}time(test{leftArrow}{leftArrow}{leftArrow}{leftArrow}{backspace}`);
    queryFieldValue.should(($el) => {
      expect($el.val()).to.eq('timetest)');
    });

    // overrides an automatically inserted brace
    queryField.type(`{selectall}{backspace}time()`);
    queryFieldValue.should(($el) => {
      expect($el.val()).to.eq('time()');
    });

    // does not override manually inserted braces
    queryField.type(`{selectall}{backspace}))`);
    queryFieldValue.should(($el) => {
      expect($el.val()).to.eq('))');
    });

    /** Runner plugin */

    // Should execute the query when enter with shift is pressed
    queryField.type(`{selectall}{backspace}{shift+enter}`);
    e2e().get('[data-testid="explore-no-data"]').should('be.visible');

    /** Suggestions plugin */
    e2e().get('[role="code"]').type(`{selectall}av`);
    e2e().contains('avg_over_time').should('be.visible');
  });
});

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

describe('Loki slate editor', () => {
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
    const queryField = e2e().get('.slate-query-field');
    queryField.type('time(');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.eq('time()');
    });

    // removes closing brace when opening brace is removed
    queryField.type('{backspace}');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.eq('time');
    });

    // keeps closing brace when opening brace is removed and inner values exist
    queryField.clear();
    queryField.type('time(test{leftArrow}{leftArrow}{leftArrow}{leftArrow}{backspace}');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.eq('timetest)');
    });

    // overrides an automatically inserted brace
    queryField.clear();
    queryField.type('time()');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.eq('time()');
    });

    // does not override manually inserted braces
    queryField.clear();
    queryField.type('))');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.eq('))');
    });

    /** Clear Plugin */

    //does not change the empty value
    queryField.clear();
    queryField.type('{ctrl+k}');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.match(/Enter a Loki query/);
    });

    // clears to the end of the line
    queryField.clear();
    queryField.type('foo{leftArrow}{leftArrow}{leftArrow}{ctrl+k}');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.match(/Enter a Loki query/);
    });

    // clears from the middle to the end of the line
    queryField.clear();
    queryField.type('foo bar{leftArrow}{leftArrow}{leftArrow}{leftArrow}{ctrl+k}');
    queryField.should(($el) => {
      expect($el.text().replace(/\uFEFF/g, '')).to.eq('foo');
    });

    /** Runner plugin */

    //should execute query when enter with shift is pressed
    queryField.clear();
    queryField.type('{shift+enter}');
    e2e().get('[data-testid="explore-no-data"]').should('be.visible');

    /** Suggestions plugin */
    e2e().get('.slate-query-field').type(`{selectall}av`);
    e2e().get('.slate-typeahead').should('be.visible').contains('avg_over_time');
  });
});

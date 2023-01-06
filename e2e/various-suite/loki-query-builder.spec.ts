import { e2e } from '@grafana/e2e';

const MISSING_LABEL_FILTER_ERROR_MESSAGE = 'Select at least 1 label filter (label and value)';
const dataSourceName = 'LokiBuilder';
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

const finalQuery = 'rate({instance=~"instance1|instance2"} | logfmt | __error__=`` [$__interval]';

describe('Loki query builder', () => {
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

  it('should be able to use all modes', () => {
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

    // Start in builder mode, click and choose query pattern
    e2e.components.QueryBuilder.queryPatterns().click();
    e2e().contains('Log query starters').click();
    e2e().contains('Use this query').click();
    e2e().contains('No pipeline errors').should('be.visible');
    e2e().contains('Logfmt').should('be.visible');
    e2e().contains('{} | logfmt | __error__=``').should('be.visible');

    // Add operation
    e2e().contains('Operations').should('be.visible').click();
    e2e().contains('Range functions').should('be.visible').click();
    e2e().contains('Rate').should('be.visible').click();
    e2e().contains('rate({} | logfmt | __error__=`` [$__interval]').should('be.visible');

    // Check for expected error
    e2e().contains(MISSING_LABEL_FILTER_ERROR_MESSAGE).should('be.visible');

    // Add labels to remove error
    e2e.components.QueryBuilder.labelSelect().should('be.visible').click().type('instance{enter}');
    e2e.components.QueryBuilder.matchOperatorSelect().should('be.visible').click().type('=~{enter}');
    e2e.components.QueryBuilder.valueSelect()
      .should('be.visible')
      .click()
      .type('instance1{enter}')
      .type('instance2{enter}');
    e2e().contains(MISSING_LABEL_FILTER_ERROR_MESSAGE).should('not.exist');
    e2e().contains(finalQuery).should('be.visible');

    // Change to code editor
    e2e().contains('label', 'Code').click();
    // We need to test this manually because the final query is split into separate DOM elements using e2e().contains(finalQuery).should('be.visible'); does not detect the query.
    e2e().contains('rate').should('be.visible');
    e2e().contains('instance1|instance2').should('be.visible');
    e2e().contains('logfmt').should('be.visible');
    e2e().contains('__error__').should('be.visible');
    e2e().contains('$__interval').should('be.visible');

    // Checks the explain mode toggle
    e2e().contains('label', 'Explain').click();
    e2e().contains('Fetch all log lines matching label filters.').should('be.visible');
  });
});

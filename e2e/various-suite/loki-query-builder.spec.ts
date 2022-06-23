import { e2e } from '@grafana/e2e';

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
      req.reply({ status: 'success', data: ['job', 'instance', 'source'] });
    });

    e2e().intercept(/series?/, (req) => {
      req.reply({ status: 'success', data: [{ source: 'data' }] });
    });

    const finalQuery = 'rate({job="unique", instance=~"instance1|instance2"} | logfmt | __error__=`` [$__interval])';

    // Go to Explore and choose Loki data source
    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container().should('be.visible').click();
    e2e().contains(dataSourceName).scrollIntoView().should('be.visible').click();

    // Switch to code editor and type query
    cy.contains('label', 'Code').click();
    e2e.components.QueryField.container().should('be.visible');
    e2e.components.QueryField.container().should('be.visible').type('{job="unique",instance=~"instance1|instance2",');

    // Check autocomplete suggestion
    cy.contains('source').should('be.visible');

    // Switch to query builder and check if query was parsed to visual query builder
    cy.contains('label', 'Builder').should('be.visible').click();
    cy.contains('Operations').should('be.visible');
    cy.contains('instance').should('be.visible');
    cy.contains('instance1').should('be.visible');
    cy.contains('instance2').should('be.visible');

    // Click and choose query pattern
    e2e.components.QueryBuilder.queryPatterns().click().type('Log query with parsing{enter}');
    cy.contains('No pipeline errors').should('be.visible');
    cy.contains('Logfmt').should('be.visible');

    // Add operation
    cy.contains('Operations').should('be.visible').click();
    cy.contains('Range functions').should('be.visible').click();
    cy.contains('Rate').should('be.visible').click();

    // Check if raw query is visible
    cy.contains(finalQuery).should('be.visible');

    // Switch to explain mode and check if query is visible
    cy.contains('label', 'Explain').click();
    cy.contains(finalQuery).should('be.visible');
  });
});

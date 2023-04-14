import { e2e } from '@grafana/e2e';

const dataSourceName = 'PromExemplar';
const addDataSource = () => {
  e2e.flows.addDataSource({
    type: 'Prometheus',
    expectedAlertMessage: 'Error reading Prometheus',
    name: dataSourceName,
    form: () => {
      e2e.components.DataSource.Prometheus.configPage.exemplarsAddButton().click();
      e2e.components.DataSource.Prometheus.configPage.internalLinkSwitch().check({ force: true });
      e2e.components.DataSource.DataSourceHttpSettings.urlInput().type('http://prom-url:9090');
      e2e.components.DataSourcePicker.inputV2().click({ force: true }).should('have.focus');

      e2e().contains('gdev-tempo').scrollIntoView().should('be.visible').click();
    },
  });
};

describe('Exemplars', () => {
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

  it('should be able to navigate to configured data source', () => {
    e2e().intercept(
      {
        pathname: '/api/ds/query',
      },
      (req) => {
        const datasourceType = req.body.queries[0].datasource.type;
        if (datasourceType === 'prometheus') {
          req.reply({ fixture: 'exemplars-query-response.json' });
        } else if (datasourceType === 'tempo') {
          req.reply({ fixture: 'tempo-response.json' });
        } else {
          req.reply({});
        }
      }
    );

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container().should('be.visible').click();
    e2e().contains(dataSourceName).scrollIntoView().should('be.visible').click();

    // Switch to code editor
    cy.contains('label', 'Code').click();

    // we need to wait for the query-field being lazy-loaded, in two steps:
    // 1. first we wait for the text 'Loading...' to appear
    // 1. then we wait for the text 'Loading...' to disappear
    const monacoLoadingText = 'Loading...';
    e2e.components.QueryField.container().should('be.visible').should('have.text', monacoLoadingText);
    e2e.components.QueryField.container().should('be.visible').should('not.have.text', monacoLoadingText);

    e2e.components.TimePicker.openButton().click();
    e2e.components.TimePicker.fromField().clear().type('2021-07-10 17:10:00');
    e2e.components.TimePicker.toField().clear().type('2021-07-10 17:30:00');
    e2e.components.TimePicker.applyTimeRange().click();
    e2e.components.QueryField.container().should('be.visible').type('exemplar-query_bucket{shift}{enter}');

    cy.wait(1000);

    cy.get('body').then((body) => {
      if (body.find(`[data-testid="time-series-zoom-to-data"]`).length > 0) {
        cy.get(`[data-testid="time-series-zoom-to-data"]`).click();
      }
    });

    e2e.components.DataSource.Prometheus.exemplarMarker().first().trigger('mouseover');
    e2e().contains('Query with gdev-tempo').click();
    e2e.components.TraceViewer.spanBar().should('have.length', 11);
  });
});

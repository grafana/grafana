import { e2e } from '@grafana/e2e';

const dataSourceName = 'PromExemplar';
const addDataSource = () => {
  e2e.flows.addDataSource({
    type: 'Prometheus',
    expectedAlertMessage: 'Bad Gateway',
    name: dataSourceName,
    form: () => {
      e2e.components.DataSource.Prometheus.configPage.exemplarsAddButton().click();
      e2e.components.DataSource.Prometheus.configPage.internalLinkSwitch().check({ force: true });
      e2e.components.DataSourcePicker.inputV2().should('be.visible').click({ force: true });

      e2e().contains('gdev-tempo').scrollIntoView().should('be.visible').click();
    },
  });
};

describe('Exemplars', () => {
  beforeEach(() => {
    e2e.flows.login('admin', 'admin');

    e2e()
      .request({ url: `/api/datasources/name/${dataSourceName}`, failOnStatusCode: false })
      .then((response) => {
        if (response.isOkStatusCode) {
          return;
        }
        addDataSource();
      });
  });

  it('should be able to navigate to configured data source', () => {
    let intercept = 'prometheus';
    e2e().intercept('/api/ds/query', (req) => {
      if (intercept === 'prometheus') {
        // For second intercept, we want to send tempo response
        intercept = 'tempo';
        req.reply({ fixture: 'exemplars-query-response.json' });
      } else {
        req.reply({ fixture: 'tempo-response.json' });
      }
    });

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.input().should('be.visible').click();
    e2e().contains(dataSourceName).scrollIntoView().should('be.visible').click();

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

    e2e.components.DataSource.Prometheus.exemplarMarker().first().trigger('mouseover');
    e2e().contains('Query with gdev-tempo').click();
    e2e.components.TraceViewer.spanBar().should('have.length', 11);
  });
});

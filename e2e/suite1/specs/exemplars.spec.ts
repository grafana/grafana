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
      e2e.components.DataSourcePicker.container()
        .should('be.visible')
        .within(() => {
          e2e.components.Select.input().should('be.visible').click({ force: true });
        });

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
    e2e().intercept('POST', '**/api/v1/query_exemplars', {
      fixture: 'exemplars-query-response.json',
    });
    e2e().intercept('POST', '**/api/v1/query_range', {
      fixture: 'prometheus-query-range-response.json',
    });
    e2e().intercept('POST', '**/api/v1/query', {
      fixture: 'prometheus-query-response.json',
    });
    e2e().intercept('POST', '**/api/ds/query', {
      fixture: 'tempo-response.json',
    });

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').click();
      });
    e2e().contains(dataSourceName).scrollIntoView().should('be.visible').click();
    e2e.components.TimePicker.openButton().click();
    e2e.components.TimePicker.fromField().clear().type('2021-05-11 19:30:00');
    e2e.components.TimePicker.toField().clear().type('2021-05-11 21:40:00');
    e2e.components.TimePicker.applyTimeRange().click();
    e2e.components.QueryField.container().should('be.visible').type('exemplar-query{shift}{enter}');

    e2e.components.DataSource.Prometheus.exemplarMarker().first().trigger('mouseover');
    e2e().contains('Query with gdev-tempo').click();
    e2e.components.TraceViewer.spanBar().should('have.length', 11);
  });
});

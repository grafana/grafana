import { e2e } from '../utils';
import { waitForMonacoToLoad } from '../utils/support/monaco';

const dataSourceName = 'PromExemplar';
const addDataSource = () => {
  e2e.flows.addDataSource({
    type: 'Prometheus',
    expectedAlertMessage: 'Prometheus',
    name: dataSourceName,
    form: () => {
      e2e.components.DataSource.Prometheus.configPage.exemplarsAddButton().click();
      e2e.components.DataSource.Prometheus.configPage.internalLinkSwitch().check({ force: true });
      e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('http://prom-url:9090');
      cy.get('[data-testid="data-testid Data source picker select container"]').click();

      cy.contains('gdev-tempo').scrollIntoView().should('be.visible').click();
    },
  });
};
// Skipping due to race conditions with same old arch test e2e/various-suite/exemplars.spec.ts
describe.skip('Exemplars', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    cy.request({
      url: `${Cypress.env('BASE_URL')}/api/datasources/name/${dataSourceName}`,
      failOnStatusCode: false,
    }).then((response) => {
      if (response.isOkStatusCode) {
        return;
      }
      addDataSource();
    });
  });

  it('should be able to navigate to configured data source', () => {
    cy.intercept(
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
    cy.contains(dataSourceName).scrollIntoView().should('be.visible').click();

    // Switch to code editor
    e2e.components.RadioButton.container().filter(':contains("Code")').click();

    // Wait for lazy loading Monaco
    waitForMonacoToLoad();

    e2e.components.TimePicker.openButton().click();
    e2e.components.TimePicker.fromField().clear().type('2021-07-10 17:10:00');
    e2e.components.TimePicker.toField().clear().type('2021-07-10 17:30:00');
    e2e.components.TimePicker.applyTimeRange().click();
    e2e.components.QueryField.container().should('be.visible').type('exemplar-query_bucket{shift}{enter}');

    cy.get(`[data-testid="time-series-zoom-to-data"]`).click();

    e2e.components.DataSource.Prometheus.exemplarMarker().first().trigger('mousemove', { force: true });
    cy.contains('Query with gdev-tempo').click();
    e2e.components.TraceViewer.spanBar().should('have.length', 11);
  });
});

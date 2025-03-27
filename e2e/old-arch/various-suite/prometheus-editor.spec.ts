import { e2e } from '../utils';

import { getResources } from './helpers/prometheus-helpers';

const DATASOURCE_ID = 'Prometheus';

type editorType = 'Code' | 'Builder';

/**
 * Login, create and save a Prometheus data source, navigate to code or builder
 *
 * @param editorType 'Code' or 'Builder'
 */
function navigateToEditor(editorType: editorType, name: string): void {
  // login
  e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);

  // select the prometheus DS
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePluginsV2(DATASOURCE_ID)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  // choose default editor
  e2e.components.DataSource.Prometheus.configPage.defaultEditor().scrollIntoView().should('exist').click();
  selectOption(editorType);

  // add url for DS to save without error
  e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('http://prom-url:9090');

  // name the DS
  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(name);
  e2e.pages.DataSource.saveAndTest().click();

  // visit explore
  e2e.pages.Explore.visit();

  // choose the right DS
  e2e.components.DataSourcePicker.container().should('be.visible').click();
  cy.contains(name).scrollIntoView().should('be.visible').click();
}

describe('Prometheus query editor', () => {
  it('should have a kickstart component', () => {
    navigateToEditor('Code', 'prometheus');
    e2e.components.QueryBuilder.queryPatterns().scrollIntoView().should('exist');
  });

  it('should have an explain component', () => {
    navigateToEditor('Code', 'prometheus');
    e2e.components.DataSource.Prometheus.queryEditor.explain().scrollIntoView().should('exist');
  });

  it('should have an editor toggle component', () => {
    navigateToEditor('Code', 'prometheus');
    e2e.components.DataSource.Prometheus.queryEditor.editorToggle().scrollIntoView().should('exist');
  });

  it('should have an options component with legend, format, step, type and exemplars', () => {
    navigateToEditor('Code', 'prometheus');
    // open options
    e2e.components.DataSource.Prometheus.queryEditor.options().scrollIntoView().should('exist').click();
    // check options
    e2e.components.DataSource.Prometheus.queryEditor.legend().scrollIntoView().should('exist');
    e2e.components.DataSource.Prometheus.queryEditor.format().scrollIntoView().should('exist');
    cy.get(`[data-test-id="prometheus-step"]`).scrollIntoView().should('exist');
    e2e.components.DataSource.Prometheus.queryEditor.type().scrollIntoView().should('exist');
    cy.get(`[data-test-id="prometheus-exemplars"]`).scrollIntoView().should('exist');
  });

  describe('Code editor', () => {
    it('navigates to the code editor with editor type as code', () => {
      navigateToEditor('Code', 'prometheusCode');
    });

    it('navigates to the code editor and opens the metrics browser with metric search, labels, label values, and all components', () => {
      navigateToEditor('Code', 'prometheusCode');

      getResources();

      e2e.components.DataSource.Prometheus.queryEditor.code.queryField().should('exist');

      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser
        .openButton()
        .contains('Metrics browser')
        .click();

      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric().should('exist');
      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelNamesFilter().should('exist');
      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelValuesFilter().should('exist');
      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery().should('exist');
      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useAsRateQuery().should('exist');
      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.validateSelector().should('exist');
      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.clear().should('exist');
    });

    it('selects a metric in the metrics browser and uses the query', () => {
      navigateToEditor('Code', 'prometheusCode');

      getResources();

      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser
        .openButton()
        .contains('Metrics browser')
        .click();

      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric().should('exist').type('met');

      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser
        .metricList()
        .should('exist')
        .contains('metric1')
        .click();

      e2e.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery().should('exist').click();

      e2e.components.DataSource.Prometheus.queryEditor.code.queryField().should('exist').contains('metric1');
    });
  });

  describe('Query builder', () => {
    it('navigates to the query builder with editor type as code', () => {
      navigateToEditor('Builder', 'prometheusBuilder');
    });

    it('the query builder contains metric select, label filters and operations', () => {
      navigateToEditor('Builder', 'prometheusBuilder');

      getResources();

      e2e.components.DataSource.Prometheus.queryEditor.builder.metricSelect().should('exist');
      e2e.components.QueryBuilder.labelSelect().should('exist');
      e2e.components.QueryBuilder.matchOperatorSelect().should('exist');
      e2e.components.QueryBuilder.valueSelect().should('exist');
    });

    it('can select a metric and provide a hint', () => {
      navigateToEditor('Builder', 'prometheusBuilder');

      getResources();

      e2e.components.DataSource.Prometheus.queryEditor.builder.metricSelect().should('exist').click();

      selectOption('metric1');

      e2e.components.DataSource.Prometheus.queryEditor.builder.hints().contains('hint: add rate');
    });

    it('should have the metrics explorer opened via the metric select', () => {
      navigateToEditor('Builder', 'prometheusBuilder');

      getResources();

      e2e.components.DataSource.Prometheus.queryEditor.builder.metricSelect().should('exist').click();

      selectOption('Metrics explorer');

      e2e.components.DataSource.Prometheus.queryEditor.builder.metricsExplorer().should('exist');
    });
  });
});

function selectOption(option: string) {
  e2e.components.Select.option().contains(option).should('be.visible').click();
}

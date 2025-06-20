import { e2e } from '../utils';
import { addDashboard } from '../utils/flows';

import { createPromDS, getResources } from './helpers/prometheus-helpers';

const DATASOURCE_ID = 'Prometheus';

const DATASOURCE_NAME = 'aprometheusAnnotationDS';

/**
 * Click dashboard settings and then the variables tab
 *
 */
function navigateToAnnotations() {
  e2e.components.PageToolbar.item('Dashboard settings').click();
  e2e.components.Tab.title('Annotations').click();
}

function addPrometheusAnnotation(annotationName: string) {
  e2e.pages.Dashboard.Settings.Annotations.List.addAnnotationCTAV2().click();
  getResources();
  e2e.pages.Dashboard.Settings.Annotations.Settings.name().clear().type(annotationName);
  e2e.components.DataSourcePicker.container().should('be.visible').click();
  cy.contains(DATASOURCE_NAME).scrollIntoView().should('be.visible').click();
}

describe('Prometheus annotations', () => {
  beforeEach(() => {
    createPromDS(DATASOURCE_ID, DATASOURCE_NAME);
  });

  it('should navigate to variable query editor', () => {
    const annotationName = 'promAnnotation';
    addDashboard();
    navigateToAnnotations();
    addPrometheusAnnotation(annotationName);

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

    // check for other parts of the annotations
    // min step
    e2e.components.DataSource.Prometheus.annotations.minStep().should('exist');

    // title
    e2e.components.DataSource.Prometheus.annotations.title().scrollIntoView().should('exist');
    // tags
    e2e.components.DataSource.Prometheus.annotations.tags().scrollIntoView().should('exist');
    // text
    e2e.components.DataSource.Prometheus.annotations.text().scrollIntoView().should('exist');
    // series value as timestamp
    e2e.components.DataSource.Prometheus.annotations.seriesValueAsTimestamp().scrollIntoView().should('exist');

    e2e.pages.Dashboard.Settings.Annotations.NewAnnotation.previewInDashboard().click();

    // check that annotation exists
    cy.get('body').contains(annotationName);
  });
});

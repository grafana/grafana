import { e2e } from '@grafana/e2e';
const DASHBOARD_ID = 'XMjIZPmik';
const DASHBOARD_NAME = 'Panel Tests - Graph Time Regions';

e2e.scenario({
  describeName: 'Auto-migrate graph panel',
  itName: 'Annotation markers exist for time regions',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });
    e2e().contains(DASHBOARD_NAME).should('be.visible');
    cy.contains('uplot-main-div').should('not.exist');

    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { '__feature.autoMigrateOldPanels': true } });

    e2e().wait(1000);

    e2e.components.Panels.Panel.title('Business Hours')
      .should('exist')
      .within(() => {
        e2e.pages.Dashboard.Annotations.marker().should('exist');
      });

    e2e.components.Panels.Panel.title("Sunday's 20-23")
      .should('exist')
      .within(() => {
        e2e.pages.Dashboard.Annotations.marker().should('exist');
      });

    e2e.components.Panels.Panel.title('Each day of week')
      .should('exist')
      .within(() => {
        e2e.pages.Dashboard.Annotations.marker().should('exist');
      });

    cy.get('body').children().find('.scrollbar-view').first().scrollTo('bottom');

    e2e.components.Panels.Panel.title('05:00')
      .should('exist')
      .within(() => {
        e2e.pages.Dashboard.Annotations.marker().should('exist');
      });

    e2e.components.Panels.Panel.title('From 22:00 to 00:30 (crossing midnight)')
      .should('exist')
      .within(() => {
        e2e.pages.Dashboard.Annotations.marker().should('exist');
      });
  },
});

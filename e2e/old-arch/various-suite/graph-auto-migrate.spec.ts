import { e2e } from '../utils';

const DASHBOARD_ID = 'XMjIZPmik';
const DASHBOARD_NAME = 'Panel Tests - Graph Time Regions';
const UPLOT_MAIN_DIV_SELECTOR = '[data-testid="uplot-main-div"]';

describe('Auto-migrate graph panel', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Graph panel is migrated with `autoMigrateOldPanels` feature toggle', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });
    cy.contains(DASHBOARD_NAME).should('be.visible');
    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('not.exist');

    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { '__feature.autoMigrateOldPanels': true } });

    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('exist');
  });

  it('Graph panel is migrated with config `disableAngular` feature toggle', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });
    cy.contains(DASHBOARD_NAME).should('be.visible');
    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('not.exist');

    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { '__feature.disableAngular': true } });

    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('exist');
  });

  it('Graph panel is migrated with `autoMigrateGraphPanel` feature toggle', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });
    cy.contains(DASHBOARD_NAME).should('be.visible');
    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('not.exist');

    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { '__feature.autoMigrateGraphPanel': true } });

    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('exist');
  });

  it('Annotation markers exist for time regions', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });
    cy.contains(DASHBOARD_NAME).should('be.visible');
    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('not.exist');

    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { '__feature.autoMigrateGraphPanel': true } });

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

    cy.scrollTo('bottom');

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
  });
});

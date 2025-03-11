import { e2e } from '../utils';

const DASHBOARD_ID = 'XMjIZPmik';
const DASHBOARD_NAME = 'Panel Tests - Graph Time Regions';
const UPLOT_MAIN_DIV_SELECTOR = '[data-testid="uplot-main-div"]';

describe('Auto-migrate graph panel', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Graph panel is auto-migrated', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });
    cy.contains(DASHBOARD_NAME).should('be.visible');
    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('not.exist');

    e2e.flows.openDashboard({ uid: DASHBOARD_ID });

    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('exist');
  });

  it('Annotation markers exist for time regions', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });
    cy.contains(DASHBOARD_NAME).should('be.visible');
    cy.get(UPLOT_MAIN_DIV_SELECTOR).should('not.exist');

    e2e.flows.openDashboard({ uid: DASHBOARD_ID });

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

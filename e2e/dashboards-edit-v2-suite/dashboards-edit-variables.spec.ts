import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit variables', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.setLocalStorage('grafana.featureToggles', 'dashboardNewLayouts=true,kubernetesDashboards=true');
  });

  it('can add a new constant variable', () => {
    e2e.pages.Dashboards.visit();

    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    e2e.components.PanelEditor.Outline.section().should('be.visible').click();
  });
});

import { e2e } from '../utils';

describe('Create a public dashboard with template variables shows a template variable warning', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Create a public dashboard with template variables shows a template variable warning', () => {
    // Opening a dashboard with template variables
    e2e.flows.openDashboard({ uid: 'HYaGDGIMk', queryParams: { '__feature.newDashboardSharingComponent': false } });

    // Open sharing modal
    e2e.components.NavToolbar.shareDashboard().click();

    // Select public dashboards tab
    e2e.components.Tab.title('Public Dashboard').click();

    // Warning Alert dashboard cannot be made public because it has template variables
    e2e.pages.ShareDashboardModal.PublicDashboard.TemplateVariablesWarningAlert().should('be.visible');

    // Configuration elements for public dashboards should not exist
    e2e.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox().should('exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CreateButton().should('exist');

    e2e.pages.ShareDashboardModal.PublicDashboard.PauseSwitch().should('not.exist');
  });
});

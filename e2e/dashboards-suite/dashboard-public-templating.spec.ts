import { e2e } from '../utils';

describe('Create a public dashboard with template variables shows a template variable warning', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Create a public dashboard with template variables shows a template variable warning', () => {
    // Opening a dashboard with template variables
    e2e.flows.openDashboard({ uid: 'HYaGDGIMk' });

    // Open sharing modal
    e2e.pages.ShareDashboardModal.shareButton().click();

    // Select public dashboards tab
    e2e.pages.ShareDashboardModal.PublicDashboard.Tab().click();

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

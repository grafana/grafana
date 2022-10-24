import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Create a public dashboard with template variables is disabled',
  itName: 'Create a public dashboard with template variables is disabled',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // Opening a dashboard with template variables
    e2e.flows.openDashboard({ uid: 'HYaGDGIMk' });

    // Open sharing modal
    e2e.pages.ShareDashboardModal.shareButton().click();

    // Select public dashboards tab
    e2e().intercept('GET', '/api/dashboards/uid/HYaGDGIMk/public-config').as('query-public-config');
    e2e.pages.ShareDashboardModal.PublicDashboard.Tab().click();
    e2e().wait('@query-public-config');

    // Warning Alert dashboard cannot be made public because it has template variables
    e2e.pages.ShareDashboardModal.PublicDashboard.TemplateVariablesWarningAlert().should('be.visible');

    // Configuration elements for public dashboards should not exist
    e2e.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.EnableSwitch().should('not.exist');
    e2e.pages.ShareDashboardModal.PublicDashboard.SaveConfigButton().should('not.exist');
  },
});

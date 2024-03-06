import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

describe('Dashboards', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('should restore scroll position', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    e2e.components.Panels.Panel.title('Panel #1').should('be.visible');

    // scroll to the bottom
    e2e.pages.Dashboard.DashNav.navV2()
      .parent()
      .parent() // Note, this will probably fail when we change the custom scrollbars
      .scrollTo('bottom', {
        timeout: 5 * 1000,
      });

    // The last panel should be visible...
    e2e.components.Panels.Panel.title('Panel #50').should('be.visible');

    // Then we open and close the panel editor
    e2e.components.Panels.Panel.menu('Panel #50').click({ force: true }); // it only shows on hover
    e2e.components.Panels.Panel.menuItems('Edit').click();
    e2e.components.PanelEditor.applyButton().click();

    // And the last panel should still be visible!
    e2e.components.Panels.Panel.title('Panel #50').should('be.visible');
  });
});

import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'c01bf42b-b783-4447-a304-8554cee1843b/datagrid-example';

describe('Dashboard panels', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can duplicate a panel', () => {
    e2e.pages.Dashboards.visit();
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    // Toggle edit mode
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    const panelTitle = 'Datagrid with CSV metric values';
    e2e.components.Panels.Panel.title(panelTitle).should('have.length', 1);

    e2e.components.Panels.Panel.menu(panelTitle).click({ force: true });
    e2e.components.Panels.Panel.menuItems('More...').trigger('mouseover');
    e2e.components.Panels.Panel.menuItems('Duplicate').click();

    e2e.components.Panels.Panel.title(panelTitle).should('have.length', 2);
  });
});

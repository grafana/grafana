import { e2e } from '../utils';

import { flows } from './dashboard-edit-flows';

describe('Dashboard panels', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can duplicate a panel', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Paste tab' });

    e2e.flows.scenes.toggleEditMode();
    const panelTitle = 'Unique';
    flows.changePanelTitle('New panel', panelTitle);

    e2e.components.Panels.Panel.title(panelTitle).should('have.length', 1);

    e2e.components.Panels.Panel.menu(panelTitle).click({ force: true });
    e2e.components.Panels.Panel.menuItems('More...').trigger('mouseover');
    e2e.components.Panels.Panel.menuItems('Duplicate').click();

    e2e.components.Panels.Panel.title(panelTitle).should('have.length', 2);

    // Save, reload, and ensure duplicate has persisted
    e2e.flows.scenes.saveDashboard();
    cy.reload();
    e2e.components.Panels.Panel.title(panelTitle).should('have.length', 2);
  });
});

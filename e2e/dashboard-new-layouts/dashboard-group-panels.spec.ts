import { e2e } from '../utils';

describe('Grouping panels', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  after(() => {
    e2e.flows.revertAllChanges();
  });

  it('can group and ungroup new panels into row', () => {
    e2e.flows.addDashboard({ title: 'Group new panels into row' });
    cy.contains('Group new panels into row').should('be.visible');

    // Toggle edit mode
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    // Add 3 panels
    e2e.flows.scenes.addFirstPanel();
    e2e.flows.scenes.addPanel();
    e2e.flows.scenes.addPanel();

    // Group into row
    e2e.flows.scenes.groupIntoRow();

    // Verify row and panel titles
    e2e.components.DashboardRow.title('New row').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    // Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify row and panel titles after reload
    e2e.components.DashboardRow.title('New row').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    // Ungroup
    e2e.flows.scenes.ungroupPanels();

    // Verify Row title is gone
    e2e.components.DashboardRow.title('New row').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    //Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify Row title is gone
    e2e.components.DashboardRow.title('New row').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  it('can group and ungroup new panels into tab', () => {
    e2e.flows.addDashboard({ title: 'Group new panels into tab' });
    cy.contains('Group new panels into tab').should('be.visible');

    // Toggle edit mode
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    // Add 3 panels
    e2e.flows.scenes.addFirstPanel();
    e2e.flows.scenes.addPanel();
    e2e.flows.scenes.addPanel();

    // Group into tab
    e2e.flows.scenes.groupIntoTab();

    // Verify tab and panel titles
    e2e.components.Tab.title('New tab').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    // Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify row and panel titles after reload
    e2e.components.Tab.title('New tab').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    // Ungroup
    e2e.flows.scenes.ungroupPanels();

    // Verify Row title is gone
    e2e.components.Tab.title('New tab').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    // Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify Row title is gone
    e2e.components.Tab.title('New tab').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  it('can group and ungroup new panels into tab with row', () => {
    e2e.flows.addDashboard({ title: 'Group new panels into tab with row' });
    cy.contains('Group new panels into tab with row').should('be.visible');

    // Toggle edit mode
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    // Add 3 panels
    e2e.flows.scenes.addFirstPanel();
    e2e.flows.scenes.addPanel();
    e2e.flows.scenes.addPanel();

    // Group into tab
    e2e.flows.scenes.groupIntoTab();
    e2e.flows.scenes.groupIntoRow();

    // Verify tab and panel titles
    e2e.components.Tab.title('New tab').should('be.visible');
    e2e.components.DashboardRow.title('New row').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    // Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify tab, row and panel titles after reload
    e2e.components.Tab.title('New tab').should('be.visible');
    e2e.components.DashboardRow.title('New row').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    // Ungroup
    e2e.flows.scenes.ungroupPanels(); // ungroup rows
    e2e.flows.scenes.ungroupPanels(); // ungroup tabs

    // Verify tab and row titles is gone
    e2e.components.Tab.title('New tab').should('not.exist');
    e2e.components.DashboardRow.title('New row').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    // Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify Row title is gone
    e2e.components.Tab.title('New tab').should('not.exist');
    e2e.components.DashboardRow.title('New row').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });
});

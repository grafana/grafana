import { e2e } from '../utils';

describe('Grouping panels', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  /*
   * Rows
   */

  it('can group and ungroup new panels into row', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Group new panels into row' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

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

    e2e.components.NavToolbar.editDashboard.editButton().click();

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

  it('can add and remove several rows', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Add and remove rows' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoRow();

    e2e.components.CanvasGridAddActions.addRow().click({ scrollBehavior: 'bottom' });
    e2e.flows.scenes.addPanel();

    e2e.components.CanvasGridAddActions.addRow().click({ scrollBehavior: 'bottom' });
    e2e.components.DashboardEditPaneSplitter.primaryBody().scrollTo('bottom', { ensureScrollable: false });
    e2e.components.CanvasGridAddActions.addPanel().should('have.length', 3).last().click();

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.DashboardRow.title('New row 2').should('exist');

    e2e.components.Panels.Panel.title('New panel').should('have.length', 5);

    //Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.DashboardRow.title('New row 2').should('exist');

    e2e.components.Panels.Panel.title('New panel').should('have.length', 5);

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.DashboardRow.title('New row 1').parent().click();
    e2e.components.EditPaneHeader.deleteButton().click();
    e2e.pages.ConfirmModal.delete().click();

    e2e.components.DashboardRow.title('New row 2').parent().click();
    e2e.components.EditPaneHeader.deleteButton().click();
    e2e.pages.ConfirmModal.delete().click();

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('not.exist');
    e2e.components.DashboardRow.title('New row 2').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('not.exist');
    e2e.components.DashboardRow.title('New row 2').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  it('can paste a copied row', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Paste row' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoRow();

    e2e.components.DashboardRow.title('New row').should('exist');

    e2e.flows.scenes.editPaneCopy();

    e2e.components.CanvasGridAddActions.pasteRow().click({ scrollBehavior: 'bottom' });

    e2e.components.DashboardEditPaneSplitter.primaryBody().scrollTo('bottom', { ensureScrollable: false });

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 6);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    cy.scrollTo('bottom');

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 6);
  });

  it('can duplicate a row', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Duplicate row' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoRow();

    e2e.components.DashboardRow.title('New row').should('exist');

    e2e.flows.scenes.editPaneDuplicate();

    e2e.components.DashboardEditPaneSplitter.primaryBody().scrollTo('bottom', { ensureScrollable: false });

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 6);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    cy.scrollTo('bottom');

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 6);
  });

  it('can collapse rows', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Collapse rows' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoRow();

    e2e.components.DashboardRow.title('New row').should('exist');

    e2e.flows.scenes.editPaneDuplicate();

    e2e.components.DashboardEditPaneSplitter.primaryBody().scrollTo('bottom', { ensureScrollable: false });

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 6);

    e2e.components.DashboardRow.title('New row').click();
    e2e.components.DashboardRow.title('New row 1').click();

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 0);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 0);
  });

  it('can convert rows into tabs when changing layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Rows to tabs' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoRow();

    e2e.components.DashboardRow.title('New row').should('exist');

    e2e.flows.scenes.editPaneDuplicate();

    e2e.components.DashboardRow.title('New row').should('exist');
    e2e.components.DashboardRow.title('New row 1').should('exist');

    e2e.components.EditPaneHeader.backButton().click({ force: true });

    // expand collapsed layouts section
    e2e.components.OptionsGroup.toggle('group-layout-category').click();

    e2e.flows.scenes.selectTabsLayout();

    e2e.components.Tab.title('New row').should('be.visible');
    e2e.components.Tab.title('New row 1').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.Tab.title('New row 1').click();
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.Tab.title('New row').should('be.visible');
    e2e.components.Tab.title('New row 1').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.Tab.title('New row').click();
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  it('can group and ungroup new panels into row with tab', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Group new panels into tab with row' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    // Group into row with tab
    e2e.flows.scenes.groupIntoRow();
    e2e.flows.scenes.groupIntoTab();

    // Verify tab and panel titles
    e2e.components.DashboardRow.title('New row').should('be.visible');
    e2e.components.Tab.title('New tab').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    // Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify tab, row and panel titles after reload
    e2e.components.DashboardRow.title('New row').should('be.visible');
    e2e.components.Tab.title('New tab').should('be.visible');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.components.NavToolbar.editDashboard.editButton().click();

    // Ungroup
    e2e.flows.scenes.ungroupPanels(); // ungroup tabs
    e2e.flows.scenes.ungroupPanels(); // ungroup rows

    // Verify tab and row titles is gone
    e2e.components.DashboardRow.title('New row').should('not.exist');
    e2e.components.Tab.title('New tab').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    // Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    // Verify Row title is gone
    e2e.components.DashboardRow.title('New row').should('not.exist');
    e2e.components.Tab.title('New tab').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  /*
   * Tabs
   */

  it('can group and ungroup new panels into tab', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Group new panels into tab' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

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

    e2e.components.NavToolbar.editDashboard.editButton().click();

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

  it('can add and remove several tabs', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Add and remove tabs' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoTab();

    e2e.components.CanvasGridAddActions.addTab().click();
    e2e.flows.scenes.addPanel();

    e2e.components.CanvasGridAddActions.addTab().click();
    e2e.flows.scenes.addPanel();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('exist');
    e2e.components.Tab.title('New tab 2').should('exist');
    e2e.components.Tab.title('New tab 2').should('have.attr', 'aria-selected', 'true');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 1);

    //Save dashboards and reload
    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('exist');
    e2e.components.Tab.title('New tab 2').should('exist');
    e2e.components.Tab.title('New tab 2').should('have.attr', 'aria-selected', 'true');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 1);

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.components.Tab.title('New tab 2').click();
    e2e.components.EditPaneHeader.deleteButton().click();
    e2e.pages.ConfirmModal.delete().click();

    e2e.components.Tab.title('New tab 1').click();
    e2e.components.EditPaneHeader.deleteButton().click();
    e2e.pages.ConfirmModal.delete().click();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('not.exist');
    e2e.components.Tab.title('New tab 2').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('not.exist');
    e2e.components.Tab.title('New tab 2').should('not.exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  it('can paste a copied tab', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Paste tab' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoTab();

    e2e.components.Tab.title('New tab').should('exist');

    e2e.flows.scenes.editPaneCopy();

    e2e.components.CanvasGridAddActions.pasteTab().click();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  it('can duplicate a tab', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Duplicate tab' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoTab();

    e2e.components.Tab.title('New tab').should('exist');

    e2e.flows.scenes.editPaneDuplicate();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('exist');
    e2e.components.Panels.Panel.title('New panel').should('have.length', 3);
  });

  it('can convert tabs into rows when changing layout', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Tabs to rows' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

    e2e.flows.scenes.groupIntoTab();

    e2e.components.Tab.title('New tab').should('exist');

    e2e.flows.scenes.editPaneDuplicate();
    e2e.flows.scenes.editPaneDuplicate();

    e2e.components.Tab.title('New tab').should('exist');
    e2e.components.Tab.title('New tab 1').should('exist');
    e2e.components.Tab.title('New tab 2').should('exist');

    e2e.components.EditPaneHeader.backButton().click({ force: true });

    // expand collapsed layouts section
    e2e.components.OptionsGroup.toggle('group-layout-category').click();

    e2e.flows.scenes.selectRowsLayout();

    e2e.components.DashboardRow.title('New tab').should('exist');
    e2e.components.Panels.Panel.title('New panel').first().should('be.visible'); // wait for panels to load
    e2e.components.DashboardRow.title('New tab 1').should('exist');
    e2e.components.DashboardRow.title('New tab 2').should('exist');

    e2e.components.DashboardEditPaneSplitter.primaryBody().scrollTo('bottom', { ensureScrollable: false });

    e2e.components.Panels.Panel.title('New panel').should('have.length', 9);

    e2e.flows.scenes.saveDashboard();
    cy.reload();

    e2e.components.DashboardRow.title('New tab').should('exist');
    e2e.components.Panels.Panel.title('New panel').first().should('be.visible'); // wait for panels to load
    e2e.components.DashboardRow.title('New tab 1').should('exist');
    e2e.components.DashboardRow.title('New tab 2').should('exist');

    cy.scrollTo('bottom');

    e2e.components.Panels.Panel.title('New panel').should('have.length', 9);
  });

  it('can group and ungroup new panels into tab with row', () => {
    e2e.flows.scenes.importV2Dashboard({ title: 'Group new panels into tab with row' });

    e2e.components.NavToolbar.editDashboard.editButton().click();

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

    e2e.components.NavToolbar.editDashboard.editButton().click();

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

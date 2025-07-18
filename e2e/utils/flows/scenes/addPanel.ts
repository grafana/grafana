import { e2e } from '../..';

export const addPanel = () => {
  e2e.components.DashboardEditPaneSplitter.primaryBody().scrollTo('bottom', { ensureScrollable: false });
  e2e.components.CanvasGridAddActions.addPanel().last().should('be.visible').click();
};

export const addFirstPanel = () => {
  // add visualization
  e2e.pages.AddDashboard.itemButton('Create new panel button').should('be.visible').click();

  // close the data source picker modal
  cy.get('[aria-label="Close"]').click({ force: true });

  e2e.components.NavToolbar.editDashboard.backToDashboardButton().click();
};

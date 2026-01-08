import { e2e } from '../..';

export const groupIntoRow = () => {
  e2e.components.CanvasGridAddActions.groupPanels().click({ scrollBehavior: 'nearest' });
  cy.contains('Group into row').click();
};

export const groupIntoTab = () => {
  e2e.components.CanvasGridAddActions.groupPanels().click({ scrollBehavior: 'nearest' });
  cy.contains('Group into tab').click();
};

export const ungroupPanels = () => {
  e2e.components.CanvasGridAddActions.ungroup().click({ scrollBehavior: 'nearest' });
};

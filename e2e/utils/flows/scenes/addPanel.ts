import { e2e } from '../..';

export const addPanel = () => {
  e2e.components.DashboardEditPaneSplitter.primaryBody().scrollTo('bottom');
  e2e.components.CanvasGridAddActions.addPanel().should('be.visible').click();
};

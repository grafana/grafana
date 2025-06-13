import { e2e } from '../..';

import { selectPanels } from './selectPanel';

export const removePanels = (...panelTitles: Array<string | RegExp>) => {
  selectPanels(panelTitles);

  // Delete the panels
  e2e.components.EditPaneHeader.deleteButton().click();

  // Confirm deletion via modal
  e2e.pages.ConfirmModal.delete().click();
};

export const removePanel = (panelTitle: string | RegExp) => {
  removePanels(panelTitle);
};

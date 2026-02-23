import { e2e } from '../..';

export const selectPanel = (panelTitle: string | RegExp, shift = false) => {
  e2e.components.Panels.Panel.headerContainer().contains(panelTitle).click({ shiftKey: shift });
};

export const selectPanels = (panelTitles: Array<string | RegExp>) => {
  for (const panel of panelTitles) {
    selectPanel(panel, true);
  }
};

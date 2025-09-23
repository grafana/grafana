import { PanelModel } from '../dashboard/state/PanelModel';

import { addLibraryPanel, updateLibraryPanel } from './state/api';
import { LibraryElementDTO, PanelModelWithLibraryPanel } from './types';

export async function saveAndRefreshLibraryPanel(panel: PanelModel, folderUid: string): Promise<LibraryElementDTO> {
  const panelSaveModel = toPanelSaveModel(panel);
  const savedPanel = await saveOrUpdateLibraryPanel(panelSaveModel, folderUid);
  updatePanelModelWithUpdate(panel, savedPanel);
  return savedPanel;
}

function toPanelSaveModel(panel: PanelModel) {
  let { scopedVars, ...panelSaveModel } = panel.getSaveModel();
  panelSaveModel = {
    libraryPanel: {
      name: panel.title,
      uid: undefined,
    },
    ...panelSaveModel,
  };

  return panelSaveModel;
}

function updatePanelModelWithUpdate(panel: PanelModel, updated: LibraryElementDTO): void {
  panel.restoreModel({
    ...updated.model,
    configRev: 0, // reset config rev, since changes have been saved
    libraryPanel: updated,
    title: panel.title,
  });
  panel.hasSavedPanelEditChange = true;
  panel.refresh();
}

function saveOrUpdateLibraryPanel(panel: PanelModelWithLibraryPanel, folderUid: string): Promise<LibraryElementDTO> {
  if (!panel.libraryPanel) {
    return Promise.reject();
  }

  if (panel.libraryPanel && panel.libraryPanel.uid === '') {
    return addLibraryPanel(panel, folderUid!);
  }

  return updateLibraryPanel(panel);
}

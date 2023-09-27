import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';
import { AppNotification } from '../../types';
import { PanelModel } from '../dashboard/state';

import { addLibraryPanel, updateLibraryPanel } from './state/api';
import { LibraryElementDTO } from './types';

export function createPanelLibraryErrorNotification(message: string): AppNotification {
  return createErrorNotification(message);
}

export function createPanelLibrarySuccessNotification(message: string): AppNotification {
  return createSuccessNotification(message);
}

export async function saveAndRefreshLibraryPanel(panel: PanelModel, folderUid: string): Promise<LibraryElementDTO> {
  const panelSaveModel = toPanelSaveModel(panel);
  const savedPanel = await saveOrUpdateLibraryPanel(panelSaveModel, folderUid);
  updatePanelModelWithUpdate(panel, savedPanel);
  return savedPanel;
}

function toPanelSaveModel(panel: PanelModel): any {
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

function saveOrUpdateLibraryPanel(panel: any, folderUid: string): Promise<LibraryElementDTO> {
  if (!panel.libraryPanel) {
    return Promise.reject();
  }

  if (panel.libraryPanel && panel.libraryPanel.uid === '') {
    return addLibraryPanel(panel, folderUid!);
  }

  return updateLibraryPanel(panel);
}

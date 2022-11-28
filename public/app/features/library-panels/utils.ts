import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';
import { AppNotification } from '../../types';
import { PanelModel } from '../dashboard/state';

import { addLibraryPanel, updateLibraryPanel } from './state/api';
import { LibraryElementDTO, PanelModelLibraryPanel } from './types';

export function createPanelLibraryErrorNotification(message: string): AppNotification {
  return createErrorNotification(message);
}

export function createPanelLibrarySuccessNotification(message: string): AppNotification {
  return createSuccessNotification(message);
}

export function toPanelModelLibraryPanel(libraryPanelDto: LibraryElementDTO): PanelModelLibraryPanel {
  const { uid, name, meta, version } = libraryPanelDto;
  return { uid, name, meta, version };
}

export async function saveAndRefreshLibraryPanel(panel: PanelModel, folderId: number): Promise<LibraryElementDTO> {
  const panelSaveModel = toPanelSaveModel(panel);
  const savedPanel = await saveOrUpdateLibraryPanel(panelSaveModel, folderId);
  updatePanelModelWithUpdate(panel, savedPanel);
  return savedPanel;
}

function toPanelSaveModel(panel: PanelModel): any {
  let panelSaveModel = panel.getSaveModel();
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
    libraryPanel: toPanelModelLibraryPanel(updated),
    title: panel.title,
  });
  panel.hasSavedPanelEditChange = true;
  panel.refresh();
}

function saveOrUpdateLibraryPanel(panel: any, folderId: number): Promise<LibraryElementDTO> {
  if (!panel.libraryPanel) {
    return Promise.reject();
  }

  if (panel.libraryPanel && panel.libraryPanel.uid === undefined) {
    return addLibraryPanel(panel, folderId!);
  }

  return updateLibraryPanel(panel);
}

import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { PanelModel } from 'app/features/dashboard/state';
import { addLibraryPanel, updateLibraryPanel } from '../state/api';

const saveLibraryPanels = (panel: any, folderId: number) => {
  if (!panel.libraryPanel) {
    return Promise.reject();
  }

  if (panel.libraryPanel && panel.libraryPanel.uid === undefined) {
    panel.libraryPanel.name = panel.title;
    return addLibraryPanel(panel, folderId!);
  }

  return updateLibraryPanel(panel, folderId!);
};

export const usePanelSave = () => {
  const [state, saveLibraryPanel] = useAsyncFn(async (panel: PanelModel, folderId: number) => {
    let panelSaveModel = panel.getSaveModel();
    panelSaveModel = {
      libraryPanel: {
        name: panel.title,
        uid: undefined,
      },
      ...panelSaveModel,
    };
    const savedPanel = await saveLibraryPanels(panelSaveModel, folderId);
    panel.restoreModel({
      ...savedPanel.model,
      libraryPanel: {
        uid: savedPanel.uid,
        name: savedPanel.name,
        meta: savedPanel.meta,
      },
    });
    panel.refresh();
    return savedPanel;
  }, []);

  useEffect(() => {
    if (state.error) {
      appEvents.emit(AppEvents.alertError, [`Error saving library panel: "${state.error.message}"`]);
    }
    if (state.value) {
      appEvents.emit(AppEvents.alertSuccess, ['Library panel saved']);
    }
  }, [state]);

  return { state, saveLibraryPanel };
};

import { pick } from 'lodash';

import store from 'app/core/store';
import { removePanel } from 'app/features/dashboard/utils/panel';
import { cleanUpPanelState } from 'app/features/panel/state/actions';
import { panelModelAndPluginReady } from 'app/features/panel/state/reducers';
import { ThunkResult } from 'app/types/store';

import { DashboardModel } from '../../../state/DashboardModel';
import { PanelModel } from '../../../state/PanelModel';

import {
  closeEditor,
  PANEL_EDITOR_UI_STATE_STORAGE_KEY,
  PanelEditorUIState,
  setDiscardChanges,
  setPanelEditorUIState,
  updateEditorInitState,
} from './reducers';

export function initPanelEditor(sourcePanel: PanelModel, dashboard: DashboardModel): ThunkResult<void> {
  return async (dispatch) => {
    const panel = dashboard.initEditPanel(sourcePanel);

    dispatch(
      updateEditorInitState({
        panel,
        sourcePanel,
      })
    );
  };
}

export function discardPanelChanges(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const { getPanel } = getStore().panelEditor;
    getPanel().configRev = 0;
    dispatch(setDiscardChanges(true));
  };
}

export function updateDuplicateLibraryPanels(
  modifiedPanel: PanelModel,
  dashboard: DashboardModel | null
): ThunkResult<void> {
  return (dispatch) => {
    if (modifiedPanel.libraryPanel?.uid === undefined || !dashboard) {
      return;
    }

    const modifiedSaveModel = modifiedPanel.getSaveModel();
    for (const panel of dashboard.panels) {
      if (skipPanelUpdate(modifiedPanel, panel)) {
        continue;
      }

      panel.restoreModel({
        ...modifiedSaveModel,
        ...pick(panel, 'gridPos', 'id'),
      });

      // Loaded plugin is not included in the persisted properties
      // So is not handled by restoreModel
      const pluginChanged = panel.plugin?.meta.id !== modifiedPanel.plugin?.meta.id;
      panel.plugin = modifiedPanel.plugin;
      panel.configRev++;

      if (pluginChanged) {
        panel.generateNewKey();

        dispatch(panelModelAndPluginReady({ key: panel.key, plugin: panel.plugin! }));
      }

      // Resend last query result on source panel query runner
      // But do this after the panel edit editor exit process has completed
      setTimeout(() => {
        panel.getQueryRunner().useLastResultFrom(modifiedPanel.getQueryRunner());
      }, 20);
    }

    if (modifiedPanel.repeat) {
      // We skip any repeated library panels so we need to update them by calling processRepeats
      // But do this after the panel edit editor exit process has completed
      setTimeout(() => dashboard.processRepeats(), 20);
    }
  };
}

export function skipPanelUpdate(modifiedPanel: PanelModel, panelToUpdate: PanelModel): boolean {
  // don't update library panels that aren't of the same type
  if (panelToUpdate.libraryPanel?.uid !== modifiedPanel.libraryPanel!.uid) {
    return true;
  }

  // don't update the modifiedPanel twice
  if (panelToUpdate.id && panelToUpdate.id === modifiedPanel.id) {
    return true;
  }

  // don't update library panels that are repeated
  if (panelToUpdate.repeatPanelId) {
    return true;
  }

  return false;
}

export function exitPanelEditor(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const dashboard = getStore().dashboard.getModel();
    const { getPanel, getSourcePanel, shouldDiscardChanges } = getStore().panelEditor;
    const panel = getPanel();

    if (dashboard) {
      dashboard.exitPanelEditor();
    }

    const sourcePanel = getSourcePanel();
    if (hasPanelChangedInPanelEdit(panel) && !shouldDiscardChanges) {
      const modifiedSaveModel = panel.getSaveModel();
      const panelTypeChanged = sourcePanel.type !== panel.type;

      dispatch(updateDuplicateLibraryPanels(panel, dashboard));

      sourcePanel.restoreModel(modifiedSaveModel);
      sourcePanel.configRev++; // force check the configs

      if (panelTypeChanged) {
        // Loaded plugin is not included in the persisted properties so is not handled by restoreModel
        sourcePanel.plugin = panel.plugin;
        sourcePanel.generateNewKey();

        await dispatch(panelModelAndPluginReady({ key: sourcePanel.key, plugin: panel.plugin! }));
      }

      // Resend last query result on source panel query runner
      // But do this after the panel edit editor exit process has completed
      setTimeout(() => {
        sourcePanel.getQueryRunner().useLastResultFrom(panel.getQueryRunner());
        sourcePanel.render();

        // If all changes where saved then reset configRev after applying changes
        if (panel.hasSavedPanelEditChange && !panel.hasChanged) {
          sourcePanel.configRev = 0;
        }
      }, 20);
    }

    // A new panel is only new until the first time we exit the panel editor
    if (sourcePanel.isNew) {
      if (!shouldDiscardChanges) {
        delete sourcePanel.isNew;
      } else {
        dashboard && removePanel(dashboard, sourcePanel, true);
      }
    }

    dispatch(cleanUpPanelState(panel.key));
    dispatch(closeEditor());
  };
}

function hasPanelChangedInPanelEdit(panel: PanelModel) {
  return panel.hasChanged || panel.hasSavedPanelEditChange || panel.isAngularPlugin();
}

export function updatePanelEditorUIState(uiState: Partial<PanelEditorUIState>): ThunkResult<void> {
  return (dispatch, getStore) => {
    const nextState = { ...getStore().panelEditor.ui, ...uiState };
    dispatch(setPanelEditorUIState(nextState));
    try {
      store.setObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, nextState);
    } catch (error) {
      console.error(error);
    }
  };
}

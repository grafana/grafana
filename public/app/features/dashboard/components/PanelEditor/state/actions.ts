import { DashboardModel, PanelModel } from '../../../state';
import { ThunkResult } from 'app/types';
import {
  closeCompleted,
  PANEL_EDITOR_UI_STATE_STORAGE_KEY,
  PanelEditorUIState,
  setPanelEditorUIState,
  updateEditorInitState,
} from './reducers';
import { cleanUpEditPanel, panelModelAndPluginReady } from '../../../state/reducers';
import store from '../../../../../core/store';

export function initPanelEditor(sourcePanel: PanelModel, dashboard: DashboardModel): ThunkResult<void> {
  return dispatch => {
    const panel = dashboard.initEditPanel(sourcePanel);

    dispatch(
      updateEditorInitState({
        panel,
        sourcePanel,
      })
    );
  };
}

export function panelEditorCleanUp(): ThunkResult<void> {
  return (dispatch, getStore) => {
    const dashboard = getStore().dashboard.getModel();
    const { getPanel, getSourcePanel, shouldDiscardChanges } = getStore().panelEditor;

    if (!shouldDiscardChanges) {
      const panel = getPanel();
      const modifiedSaveModel = panel.getSaveModel();
      const sourcePanel = getSourcePanel();
      const panelTypeChanged = sourcePanel.type !== panel.type;

      // restore the source panel id before we update source panel
      modifiedSaveModel.id = sourcePanel.id;

      sourcePanel.restoreModel(modifiedSaveModel);

      // Loaded plugin is not included in the persisted properties
      // So is not handled by restoreModel
      sourcePanel.plugin = panel.plugin;

      if (panelTypeChanged) {
        dispatch(panelModelAndPluginReady({ panelId: sourcePanel.id, plugin: panel.plugin! }));
      }

      // Resend last query result on source panel query runner
      // But do this after the panel edit editor exit process has completed
      setTimeout(() => {
        sourcePanel.getQueryRunner().useLastResultFrom(panel.getQueryRunner());
      }, 20);
    }

    if (dashboard) {
      dashboard.exitPanelEditor();
    }

    dispatch(cleanUpEditPanel());
    dispatch(closeCompleted());
  };
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

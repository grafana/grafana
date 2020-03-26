import { PanelModel, DashboardModel } from '../../../state';
import { PanelData } from '@grafana/data';
import { ThunkResult } from 'app/types';
import {
  setEditorPanelData,
  updateEditorInitState,
  closeCompleted,
  PanelEditorUIState,
  setPanelEditorUIState,
  PANEL_EDITOR_UI_STATE_STORAGE_KEY,
} from './reducers';
import { cleanUpEditPanel, panelModelAndPluginReady } from '../../../state/reducers';
import store from '../../../../../core/store';

export function initPanelEditor(sourcePanel: PanelModel, dashboard: DashboardModel): ThunkResult<void> {
  return dispatch => {
    const panel = dashboard.initPanelEditor(sourcePanel);

    const queryRunner = panel.getQueryRunner();
    const querySubscription = queryRunner.getData().subscribe({
      next: (data: PanelData) => dispatch(setEditorPanelData(data)),
    });

    dispatch(
      updateEditorInitState({
        panel,
        sourcePanel,
        querySubscription,
      })
    );
  };
}

export function panelEditorCleanUp(): ThunkResult<void> {
  return (dispatch, getStore) => {
    const dashboard = getStore().dashboard.getModel();
    const { getPanel, getSourcePanel, querySubscription, shouldDiscardChanges } = getStore().panelEditorNew;

    const panel = getPanel();
    const sourcePanel = getSourcePanel();
    const panelTypeChanged = sourcePanel.type !== panel.type;

    if (!shouldDiscardChanges) {
      const modifiedSaveModel = panel.getSaveModel();
      sourcePanel.restoreModel(modifiedSaveModel);

      if (panelTypeChanged) {
        dispatch(panelModelAndPluginReady({ panelId: sourcePanel.id, plugin: panel.plugin! }));
      }

      // Resend last query result on source panel query runner
      // But do this after the panel edit editor exit process has completed
      setTimeout(() => {
        sourcePanel.getQueryRunner().pipeDataToSubject(panel.getQueryRunner().getLastResult());
      }, 20);
    } else {
      dispatch(cleanUpEditPanel(sourcePanel));
    }

    if (dashboard) {
      dashboard.exitPanelEditor();
    }

    if (querySubscription) {
      querySubscription.unsubscribe();
    }

    dispatch(closeCompleted());
  };
}

export function updatePanelEditorUIState(uiState: Partial<PanelEditorUIState>): ThunkResult<void> {
  return (dispatch, getStore) => {
    const nextState = { ...getStore().panelEditorNew.ui, ...uiState };
    dispatch(setPanelEditorUIState(nextState));
    store.setObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, nextState);
  };
}

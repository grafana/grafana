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
import { cleanUpEditPanel } from '../../../state/reducers';
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

    if (!shouldDiscardChanges) {
      const panel = getPanel();
      const modifiedSaveModel = panel.getSaveModel();
      const sourcePanel = getSourcePanel();

      // restore the source panel id before we update source panel
      modifiedSaveModel.id = sourcePanel.id;

      sourcePanel.restoreModel(modifiedSaveModel);
      sourcePanel.getQueryRunner().pipeDataToSubject(panel.getQueryRunner().getLastResult());
    }

    dashboard.exitPanelEditor();
    querySubscription.unsubscribe();

    dispatch(cleanUpEditPanel());
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

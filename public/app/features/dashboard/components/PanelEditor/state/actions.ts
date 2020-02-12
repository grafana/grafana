import { PanelModel, DashboardModel } from '../../../state';
import { PanelData } from '@grafana/data';
import { ThunkResult } from 'app/types';
import { setEditorPanelData, updateEditorInitState, closeCompleted } from './reducers';

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
    const { getPanel, querySubscription, shouldDiscardChanges } = getStore().panelEditorNew;

    if (!shouldDiscardChanges) {
      dashboard.updatePanel(getPanel());
    }

    dashboard.exitPanelEditor();
    querySubscription.unsubscribe();

    dispatch(closeCompleted());
  };
}

import { PanelModel } from '../../../state/PanelModel';
import { PanelData } from '@grafana/data';
import { ThunkResult } from 'app/types';
import { setEditorPanelData, updateEditorInitState } from './reducers';

export function initPanelEditor(sourcePanel: PanelModel): ThunkResult<void> {
  return dispatch => {
    const panel = sourcePanel.getEditClone();

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
    const { getPanel, querySubscription } = getStore().panelEditorNew;

    dashboard.updatePanel(getPanel());

    querySubscription.unsubscribe();
  };
}

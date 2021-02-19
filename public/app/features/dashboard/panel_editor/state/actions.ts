import { getPanelEditorTab, panelEditorInitCompleted, PanelEditorTab, PanelEditorTabIds } from './reducers';
import { ThunkResult } from '../../../../types';
import { updateLocation } from '../../../../core/actions';

export const refreshPanelEditor = (props: {
  hasQueriesTab?: boolean;
  usesGraphPlugin?: boolean;
  alertingEnabled?: boolean;
}): ThunkResult<void> => {
  return async (dispatch, getState) => {
    let activeTab = getState().panelEditor.activeTab || PanelEditorTabIds.Queries;
    const { hasQueriesTab, usesGraphPlugin, alertingEnabled } = props;

    const tabs: PanelEditorTab[] = [
      getPanelEditorTab(PanelEditorTabIds.Queries),
      getPanelEditorTab(PanelEditorTabIds.Visualization),
      getPanelEditorTab(PanelEditorTabIds.Advanced),
    ];

    // handle panels that do not have queries tab
    if (!hasQueriesTab) {
      // remove queries tab
      tabs.shift();
      // switch tab
      if (activeTab === PanelEditorTabIds.Queries) {
        activeTab = PanelEditorTabIds.Visualization;
      }
    }

    if (alertingEnabled && usesGraphPlugin) {
      tabs.push(getPanelEditorTab(PanelEditorTabIds.Alert));
    }

    dispatch(panelEditorInitCompleted({ activeTab, tabs }));
  };
};

export const changePanelEditorTab = (activeTab: PanelEditorTab): ThunkResult<void> => {
  return async dispatch => {
    dispatch(updateLocation({ query: { tab: activeTab.id, openVizPicker: null }, partial: true }));
  };
};

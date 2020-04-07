import memoizeOne from 'memoize-one';
import { LocationState } from '../../../../types';
import { PanelEditorState, PanelEditorTabIds } from './reducers';

export const getActiveTabAndTabs = memoizeOne((location: LocationState, panelEditor: PanelEditorState) => {
  const panelEditorTab = panelEditor.tabs.length > 0 ? panelEditor.tabs[0].id : PanelEditorTabIds.Queries;
  return {
    activeTab: location.query.tab || panelEditorTab,
    tabs: panelEditor.tabs,
  };
});

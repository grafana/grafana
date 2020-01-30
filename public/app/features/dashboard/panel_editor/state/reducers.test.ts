import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import {
  getPanelEditorTab,
  initialState,
  panelEditorCleanUp,
  panelEditorInitCompleted,
  panelEditorReducer,
  PanelEditorState,
  PanelEditorTab,
  PanelEditorTabIds,
} from './reducers';

describe('panelEditorReducer', () => {
  describe('when panelEditorInitCompleted is dispatched', () => {
    it('then state should be correct', () => {
      const activeTab = PanelEditorTabIds.Alert;
      const tabs: PanelEditorTab[] = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
      ];
      reducerTester<PanelEditorState>()
        .givenReducer(panelEditorReducer, initialState)
        .whenActionIsDispatched(panelEditorInitCompleted({ activeTab, tabs }))
        .thenStateShouldEqual({ activeTab, tabs });
    });
  });

  describe('when panelEditorCleanUp is dispatched', () => {
    it('then state should be intialState', () => {
      const activeTab = PanelEditorTabIds.Alert;
      const tabs: PanelEditorTab[] = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
      ];
      reducerTester<PanelEditorState>()
        .givenReducer(panelEditorReducer, { activeTab, tabs })
        .whenActionIsDispatched(panelEditorCleanUp())
        .thenStateShouldEqual(initialState);
    });
  });
});

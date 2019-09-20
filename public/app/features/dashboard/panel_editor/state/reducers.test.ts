import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { initialState, panelEditorReducer, PanelEditorTabIds, PanelEditorTab, getPanelEditorTab } from './reducers';
import { panelEditorInitCompleted, panelEditorCleanUp } from './actions';

describe('panelEditorReducer', () => {
  describe('when panelEditorInitCompleted is dispatched', () => {
    it('then state should be correct', () => {
      const activeTab = PanelEditorTabIds.Alert;
      const tabs: PanelEditorTab[] = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
      ];
      reducerTester()
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
      reducerTester()
        .givenReducer(panelEditorReducer, { activeTab, tabs })
        .whenActionIsDispatched(panelEditorCleanUp())
        .thenStateShouldEqual(initialState);
    });
  });
});

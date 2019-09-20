import { thunkTester } from '../../../../../test/core/thunk/thunkTester';
import { initialState, getPanelEditorTab, PanelEditorTabIds } from './reducers';
import { refreshPanelEditor, panelEditorInitCompleted, changePanelEditorTab } from './actions';
import { updateLocation } from '../../../../core/actions';

describe('refreshPanelEditor', () => {
  describe('when called and there is no activeTab in state', () => {
    it('then the dispatched action should default the activeTab to PanelEditorTabIds.Queries', async () => {
      const activeTab = PanelEditorTabIds.Queries;
      const tabs = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
        getPanelEditorTab(PanelEditorTabIds.Alert),
      ];
      const dispatchedActions = await thunkTester({ panelEditor: { ...initialState, activeTab: null } })
        .givenThunk(refreshPanelEditor)
        .whenThunkIsDispatched({ hasQueriesTab: true, alertingEnabled: true, usesGraphPlugin: true });

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0]).toEqual(panelEditorInitCompleted({ activeTab, tabs }));
    });
  });

  describe('when called and there is already an activeTab in state', () => {
    it('then the dispatched action should include activeTab from state', async () => {
      const activeTab = PanelEditorTabIds.Visualization;
      const tabs = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
        getPanelEditorTab(PanelEditorTabIds.Alert),
      ];
      const dispatchedActions = await thunkTester({ panelEditor: { ...initialState, activeTab } })
        .givenThunk(refreshPanelEditor)
        .whenThunkIsDispatched({ hasQueriesTab: true, alertingEnabled: true, usesGraphPlugin: true });

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0]).toEqual(panelEditorInitCompleted({ activeTab, tabs }));
    });
  });

  describe('when called and plugin has no queries tab', () => {
    it('then the dispatched action should not include Queries tab and default the activeTab to PanelEditorTabIds.Visualization', async () => {
      const activeTab = PanelEditorTabIds.Visualization;
      const tabs = [
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
        getPanelEditorTab(PanelEditorTabIds.Alert),
      ];
      const dispatchedActions = await thunkTester({ panelEditor: { ...initialState } })
        .givenThunk(refreshPanelEditor)
        .whenThunkIsDispatched({ hasQueriesTab: false, alertingEnabled: true, usesGraphPlugin: true });

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0]).toEqual(panelEditorInitCompleted({ activeTab, tabs }));
    });
  });

  describe('when called and alerting is enabled and the visualization is the graph plugin', () => {
    it('then the dispatched action should include the alert tab', async () => {
      const activeTab = PanelEditorTabIds.Queries;
      const tabs = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
        getPanelEditorTab(PanelEditorTabIds.Alert),
      ];
      const dispatchedActions = await thunkTester({ panelEditor: { ...initialState } })
        .givenThunk(refreshPanelEditor)
        .whenThunkIsDispatched({ hasQueriesTab: true, alertingEnabled: true, usesGraphPlugin: true });

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0]).toEqual(panelEditorInitCompleted({ activeTab, tabs }));
    });
  });

  describe('when called and alerting is not enabled', () => {
    it('then the dispatched action should not include the alert tab', async () => {
      const activeTab = PanelEditorTabIds.Queries;
      const tabs = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
      ];
      const dispatchedActions = await thunkTester({ panelEditor: { ...initialState } })
        .givenThunk(refreshPanelEditor)
        .whenThunkIsDispatched({ hasQueriesTab: true, alertingEnabled: false, usesGraphPlugin: true });

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0]).toEqual(panelEditorInitCompleted({ activeTab, tabs }));
    });
  });

  describe('when called  and the visualization is not the graph plugin', () => {
    it('then the dispatched action should not include the alert tab', async () => {
      const activeTab = PanelEditorTabIds.Queries;
      const tabs = [
        getPanelEditorTab(PanelEditorTabIds.Queries),
        getPanelEditorTab(PanelEditorTabIds.Visualization),
        getPanelEditorTab(PanelEditorTabIds.Advanced),
      ];
      const dispatchedActions = await thunkTester({ panelEditor: { ...initialState } })
        .givenThunk(refreshPanelEditor)
        .whenThunkIsDispatched({ hasQueriesTab: true, alertingEnabled: true, usesGraphPlugin: false });

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0]).toEqual(panelEditorInitCompleted({ activeTab, tabs }));
    });
  });
});

describe('changePanelEditorTab', () => {
  describe('when called', () => {
    it('then it should dispatch correct actions', async () => {
      const activeTab = getPanelEditorTab(PanelEditorTabIds.Visualization);
      const dispatchedActions = await thunkTester({})
        .givenThunk(changePanelEditorTab)
        .whenThunkIsDispatched(activeTab);

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions).toEqual([
        updateLocation({ query: { tab: activeTab.id, openVizPicker: null }, partial: true }),
      ]);
    });
  });
});

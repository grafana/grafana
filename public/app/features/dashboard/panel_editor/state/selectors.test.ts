import { getActiveTabAndTabs } from './selectors';
import { LocationState } from '../../../../types';
import { getPanelEditorTab, PanelEditorState, PanelEditorTab, PanelEditorTabIds } from './reducers';

describe('getActiveTabAndTabs', () => {
  describe('when called and location state contains tab', () => {
    it('then it should return location state', () => {
      const activeTabId = 1337;
      const location: LocationState = {
        path: 'a path',
        lastUpdated: 1,
        replace: false,
        routeParams: {},
        query: {
          tab: activeTabId,
        },
        url: 'an url',
      };
      const panelEditor: PanelEditorState = {
        activeTab: PanelEditorTabIds.Queries,
        tabs: [],
      };

      const result = getActiveTabAndTabs(location, panelEditor);

      expect(result).toEqual({
        activeTab: activeTabId,
        tabs: [],
      });
    });
  });

  describe('when called without location state and PanelEditor state contains tabs', () => {
    it('then it should return the id for the first tab in PanelEditor state', () => {
      const activeTabId = PanelEditorTabIds.Visualization;
      const tabs = [getPanelEditorTab(PanelEditorTabIds.Visualization), getPanelEditorTab(PanelEditorTabIds.Advanced)];
      const location: LocationState = {
        path: 'a path',
        lastUpdated: 1,
        replace: false,
        routeParams: {},
        query: {
          tab: undefined,
        },
        url: 'an url',
      };
      const panelEditor: PanelEditorState = {
        activeTab: PanelEditorTabIds.Advanced,
        tabs,
      };

      const result = getActiveTabAndTabs(location, panelEditor);

      expect(result).toEqual({
        activeTab: activeTabId,
        tabs,
      });
    });
  });

  describe('when called without location state and PanelEditor state does not contain tabs', () => {
    it('then it should return PanelEditorTabIds.Queries', () => {
      const activeTabId = PanelEditorTabIds.Queries;
      const tabs: PanelEditorTab[] = [];
      const location: LocationState = {
        path: 'a path',
        lastUpdated: 1,
        replace: false,
        routeParams: {},
        query: {
          tab: undefined,
        },
        url: 'an url',
      };
      const panelEditor: PanelEditorState = {
        activeTab: PanelEditorTabIds.Advanced,
        tabs,
      };

      const result = getActiveTabAndTabs(location, panelEditor);

      expect(result).toEqual({
        activeTab: activeTabId,
        tabs,
      });
    });
  });
});

import { panelModelAndPluginReady, removePanel } from 'app/features/panel/state/reducers';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

import { thunkTester } from '../../../../../../test/core/thunk/thunkTester';
import { DashboardModel, PanelModel } from '../../../state';

import { exitPanelEditor, initPanelEditor, skipPanelUpdate } from './actions';
import { closeEditor, initialState, PanelEditorState } from './reducers';

describe('panelEditor actions', () => {
  describe('initPanelEditor', () => {
    it('initPanelEditor should create edit panel model as clone', async () => {
      const dashboard = new DashboardModel({
        panels: [{ id: 12, type: 'graph' }],
      });
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });

      const dispatchedActions = await thunkTester({
        panelEditor: { ...initialState },
        plugins: {
          panels: {},
        },
      })
        .givenThunk(initPanelEditor)
        .whenThunkIsDispatched(sourcePanel, dashboard);

      expect(dispatchedActions.length).toBe(2);
      expect(dispatchedActions[0].type).toBe(panelModelAndPluginReady.type);

      expect(dispatchedActions[1].payload.sourcePanel).toBe(sourcePanel);
      expect(dispatchedActions[1].payload.panel).not.toBe(sourcePanel);
      expect(dispatchedActions[1].payload.panel.id).toBe(sourcePanel.id);
    });
  });

  describe('panelEditorCleanUp', () => {
    it('should update source panel', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      const dashboard = new DashboardModel({
        panels: [{ id: 12, type: 'graph' }],
      });

      const panel = dashboard.initEditPanel(sourcePanel);
      panel.updateOptions({ prop: true });

      const state: PanelEditorState = {
        ...initialState(),
        getPanel: () => panel,
        getSourcePanel: () => sourcePanel,
      };

      const dispatchedActions = await thunkTester({
        panels: {},
        panelEditor: state,
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(exitPanelEditor)
        .whenThunkIsDispatched();

      expect(dispatchedActions.length).toBe(2);
      expect(dispatchedActions[0].type).toBe(removePanel.type);
      expect(dispatchedActions[1].type).toBe(closeEditor.type);
      expect(sourcePanel.getOptions()).toEqual({ prop: true });
      expect(sourcePanel.id).toEqual(12);
    });

    it('should dispatch panelModelAndPluginReady if type changed', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      const dashboard = new DashboardModel({
        panels: [{ id: 12, type: 'graph' }],
      });

      const panel = dashboard.initEditPanel(sourcePanel);
      panel.type = 'table';
      panel.plugin = getPanelPlugin({ id: 'table' });
      panel.updateOptions({ prop: true });

      const state: PanelEditorState = {
        ...initialState(),
        getPanel: () => panel,
        getSourcePanel: () => sourcePanel,
      };

      const panelDestroy = (panel.destroy = jest.fn());

      const dispatchedActions = await thunkTester({
        panelEditor: state,
        panels: {},
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(exitPanelEditor)
        .whenThunkIsDispatched();

      expect(dispatchedActions.length).toBe(3);
      expect(dispatchedActions[0].type).toBe(panelModelAndPluginReady.type);
      expect(sourcePanel.plugin).toEqual(panel.plugin);
      expect(panelDestroy.mock.calls.length).toEqual(1);
    });

    it('should discard changes when shouldDiscardChanges is true', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      sourcePanel.plugin = {
        customFieldConfigs: {},
      } as any;

      const dashboard = new DashboardModel({
        panels: [{ id: 12, type: 'graph' }],
      });

      const panel = dashboard.initEditPanel(sourcePanel);
      panel.updateOptions({ prop: true });

      const state: PanelEditorState = {
        ...initialState(),
        shouldDiscardChanges: true,
        getPanel: () => panel,
        getSourcePanel: () => sourcePanel,
      };

      const dispatchedActions = await thunkTester({
        panelEditor: state,
        panels: {},
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(exitPanelEditor)
        .whenThunkIsDispatched();

      expect(dispatchedActions.length).toBe(2);
      expect(sourcePanel.getOptions()).toEqual({});
    });

    it('should not increment configRev when no changes made and leaving panel edit', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      sourcePanel.plugin = getPanelPlugin({});

      const dashboard = new DashboardModel({
        panels: [{ id: 12, type: 'graph' }],
      });

      const panel = dashboard.initEditPanel(sourcePanel);

      const state: PanelEditorState = {
        ...initialState(),
        getPanel: () => panel,
        getSourcePanel: () => sourcePanel,
      };

      await thunkTester({
        panelEditor: state,
        panels: {},
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(exitPanelEditor)
        .whenThunkIsDispatched();

      expect(sourcePanel.configRev).toEqual(0);
    });
  });

  describe('skipPanelUpdate', () => {
    describe('when called with panel with an library uid different from the modified panel', () => {
      it('then it should return true', () => {
        const meta: any = {};
        const modified: any = { libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } };
        const panel: any = { libraryPanel: { uid: '456', name: 'Name', meta, version: 1 } };

        expect(skipPanelUpdate(modified, panel)).toEqual(true);
      });
    });

    describe('when called with a panel that is the same as the modified panel', () => {
      it('then it should return true', () => {
        const meta: any = {};
        const modified: any = { id: 14, libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } };
        const panel: any = { id: 14, libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } };

        expect(skipPanelUpdate(modified, panel)).toEqual(true);
      });
    });

    describe('when called with a panel that is repeated', () => {
      it('then it should return true', () => {
        const meta: any = {};
        const modified: any = { libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } };
        const panel: any = { repeatPanelId: 14, libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } };

        expect(skipPanelUpdate(modified, panel)).toEqual(true);
      });
    });

    describe('when called with a panel that is a duplicate of the modified panel', () => {
      it('then it should return false', () => {
        const meta: any = {};
        const modified: any = { libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } };
        const panel: any = { libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } };

        expect(skipPanelUpdate(modified, panel)).toEqual(false);
      });
    });
  });
});

import { PanelPlugin } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { LibraryElementDTOMeta } from '@grafana/schema';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { panelModelAndPluginReady, removePanel } from 'app/features/panel/state/reducers';

import { thunkTester } from '../../../../../../test/core/thunk/thunkTester';
import { PanelModel } from '../../../state/PanelModel';

import { exitPanelEditor, initPanelEditor, skipPanelUpdate } from './actions';
import { closeEditor, initialState, PanelEditorState } from './reducers';

describe('panelEditor actions', () => {
  describe('initPanelEditor', () => {
    it('initPanelEditor should create edit panel model as clone', async () => {
      const dashboard = createDashboardModelFixture({
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

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0].payload.sourcePanel).toBe(sourcePanel);
      expect(dispatchedActions[0].payload.panel).not.toBe(sourcePanel);
      expect(dispatchedActions[0].payload.panel.id).toBe(sourcePanel.id);
    });
  });

  describe('panelEditorCleanUp', () => {
    it('should update source panel', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      const dashboard = createDashboardModelFixture({
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
      const dashboard = createDashboardModelFixture({
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
      } as unknown as PanelPlugin;

      const dashboard = createDashboardModelFixture({
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
      sourcePanel.plugin.angularPanelCtrl = undefined;

      const dashboard = createDashboardModelFixture({
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

    it('should apply changes when dashboard was saved from panel edit', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      sourcePanel.plugin = getPanelPlugin({});
      sourcePanel.plugin.angularPanelCtrl = undefined;

      const dashboard = createDashboardModelFixture({
        panels: [{ id: 12, type: 'graph' }],
      });

      const panel = dashboard.initEditPanel(sourcePanel);

      const state: PanelEditorState = {
        ...initialState(),
        getPanel: () => panel,
        getSourcePanel: () => sourcePanel,
      };

      panel.setProperty('title', 'new title');
      panel.configRev = 0;
      panel.hasSavedPanelEditChange = true;

      await thunkTester({
        panelEditor: state,
        panels: {},
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(exitPanelEditor)
        .whenThunkIsDispatched();

      expect(sourcePanel.configRev).toEqual(1);

      await new Promise((r) => setTimeout(r, 30));

      // expect configRev to be reset to 0 as it was saved
      expect(sourcePanel.hasChanged).toEqual(false);
    });

    it('should apply changes when leaving panel edit with angular panel', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      sourcePanel.plugin = getPanelPlugin({});
      sourcePanel.plugin.angularPanelCtrl = {};

      const dashboard = createDashboardModelFixture({
        panels: [{ id: 12, type: 'graph' }],
      });

      const panel = dashboard.initEditPanel(sourcePanel);

      const state: PanelEditorState = {
        ...initialState(),
        getPanel: () => panel,
        getSourcePanel: () => sourcePanel,
      };

      // not using panel.setProperty here to simulate any prop change done from angular
      panel.title = 'Changed title';

      await thunkTester({
        panelEditor: state,
        panels: {},
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(exitPanelEditor)
        .whenThunkIsDispatched();

      expect(sourcePanel.isAngularPlugin()).toBe(true);
      expect(sourcePanel.title).toEqual('Changed title');
      expect(sourcePanel.configRev).toEqual(1);
    });
  });

  describe('skipPanelUpdate', () => {
    describe('when called with panel with an library uid different from the modified panel', () => {
      it('then it should return true', () => {
        const meta = {} as LibraryElementDTOMeta;
        const modified = new PanelModel({ libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } });
        const panel = new PanelModel({ libraryPanel: { uid: '456', name: 'Name', meta, version: 1 } });

        expect(skipPanelUpdate(modified, panel)).toEqual(true);
      });
    });

    describe('when called with a panel that is the same as the modified panel', () => {
      it('then it should return true', () => {
        const meta = {} as LibraryElementDTOMeta;
        const modified = new PanelModel({ id: 14, libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } });
        const panel = new PanelModel({ id: 14, libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } });

        expect(skipPanelUpdate(modified, panel)).toEqual(true);
      });
    });

    describe('when called with a panel that is repeated', () => {
      it('then it should return true', () => {
        const meta = {} as LibraryElementDTOMeta;
        const modified = new PanelModel({ libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } });
        const panel = new PanelModel({
          repeatPanelId: 14,
          libraryPanel: { uid: '123', name: 'Name', meta, version: 1 },
        });

        expect(skipPanelUpdate(modified, panel)).toEqual(true);
      });
    });

    describe('when called with a panel that is a duplicate of the modified panel', () => {
      it('then it should return false', () => {
        const meta = {} as LibraryElementDTOMeta;
        const modified = new PanelModel({ libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } });
        const panel = new PanelModel({ libraryPanel: { uid: '123', name: 'Name', meta, version: 1 } });

        expect(skipPanelUpdate(modified, panel)).toEqual(false);
      });
    });
  });
});

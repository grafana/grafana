import { thunkTester } from '../../../../../../test/core/thunk/thunkTester';
import { closeCompleted, initialState, PanelEditorState } from './reducers';
import { initPanelEditor, panelEditorCleanUp } from './actions';
import { cleanUpEditPanel, panelModelAndPluginReady } from '../../../state/reducers';
import { DashboardModel, PanelModel } from '../../../state';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

describe('panelEditor actions', () => {
  describe('initPanelEditor', () => {
    it('initPanelEditor should create edit panel model as clone', async () => {
      const dashboard = new DashboardModel({
        panels: [{ id: 12, type: 'graph' }],
      });
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });

      const dispatchedActions = await thunkTester({
        panelEditorNew: { ...initialState },
      })
        .givenThunk(initPanelEditor)
        .whenThunkIsDispatched(sourcePanel, dashboard);

      expect(dispatchedActions.length).toBe(1);
      expect(dispatchedActions[0].payload.sourcePanel).toBe(sourcePanel);
      expect(dispatchedActions[0].payload.panel).not.toBe(sourcePanel);
      expect(dispatchedActions[0].payload.panel.id).not.toBe(sourcePanel.id);
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
        panelEditor: state,
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(panelEditorCleanUp)
        .whenThunkIsDispatched();

      expect(dispatchedActions.length).toBe(2);
      expect(dispatchedActions[0].type).toBe(cleanUpEditPanel.type);
      expect(dispatchedActions[1].type).toBe(closeCompleted.type);
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
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(panelEditorCleanUp)
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
        dashboard: {
          getModel: () => dashboard,
        },
      })
        .givenThunk(panelEditorCleanUp)
        .whenThunkIsDispatched();

      expect(dispatchedActions.length).toBe(2);
      expect(sourcePanel.getOptions()).toEqual({});
    });
  });
});

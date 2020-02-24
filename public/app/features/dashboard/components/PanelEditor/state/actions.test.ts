import { thunkTester } from '../../../../../../test/core/thunk/thunkTester';
import { initialState } from './reducers';
import { initPanelEditor, panelEditorCleanUp } from './actions';
import { PanelEditorStateNew, closeCompleted } from './reducers';
import { cleanUpEditPanel } from '../../../state/reducers';
import { PanelModel, DashboardModel } from '../../../state';

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
    it('create update source panel', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });
      const dashboard = new DashboardModel({
        panels: [{ id: 12, type: 'graph' }],
      });

      const panel = sourcePanel.getEditClone();
      panel.updateOptions({ prop: true });

      const state: PanelEditorStateNew = {
        ...initialState,
        getPanel: () => panel,
        getSourcePanel: () => sourcePanel,
        querySubscription: { unsubscribe: jest.fn() },
      };

      const dispatchedActions = await thunkTester({
        panelEditorNew: state,
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
  });
});

import { PanelModel } from 'app/features/dashboard/state';
import { thunkTester } from '../../../../test/core/thunk/thunkTester';
import { changePanelPlugin } from './actions';
import { panelModelAndPluginReady } from './reducers';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

jest.mock('app/features/plugins/importPanelPlugin', () => {
  return {
    importPanelPlugin: function () {
      return Promise.resolve(
        getPanelPlugin({
          id: 'table',
        })
      );
    },
  };
});

describe('panel state actions', () => {
  describe('changePanelPlugin', () => {
    it('Should load plugin and call changePlugin', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });

      const dispatchedActions = await thunkTester({
        plugins: {
          panels: {},
        },
        panels: {},
      })
        .givenThunk(changePanelPlugin)
        .whenThunkIsDispatched(sourcePanel, 'table');

      expect(dispatchedActions.length).toBe(2);
      expect(dispatchedActions[0].type).toBe('plugins/loadPanelPlugin/fulfilled');
      expect(dispatchedActions[1].type).toBe(panelModelAndPluginReady.type);
      expect(sourcePanel.type).toBe('table');
    });
  });
});

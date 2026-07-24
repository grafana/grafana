import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { getPanelPlugin, mockStandardFieldConfigOptions } from '@grafana/data/test';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { panelPluginLoaded } from 'app/features/plugins/admin/state/actions';

import { thunkTester } from '../../../../test/core/thunk/thunkTester';

import { changePanelPlugin } from './actions';
import { panelModelAndPluginReady } from './reducers';

jest.mock('app/features/plugins/importPanelPlugin', () => {
  return {
    importPanelPlugin: function () {
      return Promise.resolve(
        getPanelPlugin({
          id: 'table',
        }).useFieldConfig()
      );
    },
  };
});

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => undefined,
    };
  },
}));

standardFieldConfigEditorRegistry.setInit(() => mockStandardFieldConfigOptions());
standardEditorsRegistry.setInit(() => mockStandardFieldConfigOptions());

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
        .whenThunkIsDispatched({
          panel: sourcePanel,
          pluginId: 'table',
        });

      expect(dispatchedActions.length).toBe(2);
      expect(dispatchedActions[0].type).toBe(panelPluginLoaded.type);
      expect(dispatchedActions[1].type).toBe(panelModelAndPluginReady.type);
      expect(sourcePanel.type).toBe('table');
    });

    it('Should apply options and fieldConfig', async () => {
      const sourcePanel = new PanelModel({ id: 12, type: 'graph' });

      await thunkTester({
        plugins: {
          panels: {},
        },
        panels: {},
      })
        .givenThunk(changePanelPlugin)
        .whenThunkIsDispatched({
          panel: sourcePanel,
          pluginId: 'table',
          options: {
            showHeader: true,
          },
          fieldConfig: {
            defaults: {
              unit: 'short',
            },
            overrides: [],
          },
        });

      expect(sourcePanel.options.showHeader).toBe(true);
      expect(sourcePanel.fieldConfig.defaults.unit).toBe('short');
    });
  });
});

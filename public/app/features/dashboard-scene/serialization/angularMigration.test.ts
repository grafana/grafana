import { PanelTypeChangedHandler } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { PanelModel } from 'app/features/dashboard/state';

import { getAngularPanelMigrationHandler } from './angularMigration';

describe('getAngularPanelMigrationHandler', () => {
  describe('Given an old angular panel', () => {
    it('Should call migration handler', () => {
      const onPanelTypeChanged: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
        panel.fieldConfig = { defaults: { unit: 'bytes' }, overrides: [] };
        return { name: prevOptions.angular.oldOptionProp };
      };

      const reactPlugin = getPanelPlugin({ id: 'timeseries' }).setPanelChangeHandler(onPanelTypeChanged);

      const oldModel = new PanelModel({
        autoMigrateFrom: 'graph',
        oldOptionProp: 'old name',
        type: 'timeseries',
      });

      const mutatedModel = {
        id: 1,
        type: 'timeseries',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      };

      getAngularPanelMigrationHandler(oldModel)(mutatedModel, reactPlugin);

      expect(mutatedModel.options).toEqual({ name: 'old name' });
      expect(mutatedModel.fieldConfig).toEqual({ defaults: { unit: 'bytes' }, overrides: [] });
    });
  });
});

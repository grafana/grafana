import { FieldConfigSource } from '@grafana/data';
import { DeepPartial, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { VizPanelManager } from './VizPanelManager';

describe('VizPanelManager', () => {
  describe('changePluginType', () => {
    it('Should successfully change from one viz type to another', () => {
      const vizPanelManager = getVizPanelManager();
      expect(vizPanelManager.state.panel.state.pluginId).toBe('table');
      vizPanelManager.changePluginType('timeseries');
      expect(vizPanelManager.state.panel.state.pluginId).toBe('timeseries');
    });

    it('Should clear custom options', () => {
      const overrides = [
        {
          matcher: { id: 'matcherOne' },
          properties: [{ id: 'custom.propertyOne' }, { id: 'custom.propertyTwo' }, { id: 'standardProperty' }],
        },
      ];
      const vizPanelManager = getVizPanelManager(undefined, {
        defaults: {
          custom: 'Custom',
        },
        overrides,
      });

      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toBe('Custom');
      expect(vizPanelManager.state.panel.state.fieldConfig.overrides).toBe(overrides);

      vizPanelManager.changePluginType('timeseries');

      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toStrictEqual({});
      expect(vizPanelManager.state.panel.state.fieldConfig.overrides[0].properties).toHaveLength(1);
      expect(vizPanelManager.state.panel.state.fieldConfig.overrides[0].properties[0].id).toBe('standardProperty');
    });

    it('Should restore cached options/fieldConfig if they exist', () => {
      const vizPanelManager = getVizPanelManager(
        {
          customOption: 'A',
        },
        { defaults: { custom: 'Custom' }, overrides: [] }
      );

      vizPanelManager.changePluginType('timeseries');
      //@ts-ignore
      expect(vizPanelManager.state.panel.state.options['customOption']).toBeUndefined();
      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toStrictEqual({});

      vizPanelManager.changePluginType('table');

      //@ts-ignore
      expect(vizPanelManager.state.panel.state.options['customOption']).toBe('A');
      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toBe('Custom');
    });
  });
});

function getVizPanelManager(
  options: {} = {},
  fieldConfig: FieldConfigSource<DeepPartial<{}>> = { overrides: [], defaults: {} }
) {
  const vizPanel = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
    options,
    fieldConfig,
  });

  const vizPanelManager = new VizPanelManager(vizPanel);

  return vizPanelManager;
}

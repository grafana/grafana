import React from 'react';

import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

import { VizPanel } from './VizPanel';

let pluginToLoad: PanelPlugin | undefined;

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: jest.fn(() => pluginToLoad),
}));

interface OptionsPlugin1 {
  showThresholds: boolean;
  option2?: string;
}

interface FieldConfigPlugin1 {
  customProp?: boolean;
  customProp2?: boolean;
  junkProp?: boolean;
}

function getTestPlugin1() {
  const pluginToLoad = getPanelPlugin(
    {
      id: 'custom-plugin-id',
    },
    () => <div>My custom panel</div>
  );

  pluginToLoad.meta.info.version = '1.0.0';
  pluginToLoad.setPanelOptions((builder) => {
    builder.addBooleanSwitch({
      name: 'Show thresholds',
      path: 'showThresholds',
      defaultValue: true,
    });
    builder.addTextInput({
      name: 'option2',
      path: 'option2',
      defaultValue: undefined,
    });
  });

  pluginToLoad.useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Unit]: {
        defaultValue: 'flop',
      },
      [FieldConfigProperty.Decimals]: {
        defaultValue: 2,
      },
    },
    useCustomConfig: (builder) => {
      builder.addBooleanSwitch({
        name: 'CustomProp',
        path: 'customProp',
        defaultValue: false,
      });
      builder.addBooleanSwitch({
        name: 'customProp2',
        path: 'customProp2',
        defaultValue: false,
      });
    },
  });

  pluginToLoad.setMigrationHandler((panel) => {
    if (panel.fieldConfig.defaults.custom) {
      panel.fieldConfig.defaults.custom.customProp2 = true;
    }

    return { option2: 'hello' };
  });

  return pluginToLoad;
}

describe('VizPanel', () => {
  describe('when activated', () => {
    let panel: VizPanel<OptionsPlugin1, FieldConfigPlugin1>;

    beforeAll(async () => {
      panel = new VizPanel<OptionsPlugin1, FieldConfigPlugin1>({
        pluginId: 'custom-plugin-id',
        fieldConfig: {
          defaults: { custom: { junkProp: true } },
          overrides: [],
        },
      });

      pluginToLoad = getTestPlugin1();
      panel.activate();
    });

    it('load plugin', () => {
      expect(panel.getPlugin()).toBe(pluginToLoad);
    });

    it('should call panel migration handler', () => {
      expect(panel.state.options.option2).toEqual('hello');
      expect(panel.state.fieldConfig.defaults.custom?.customProp2).toEqual(true);
    });

    it('should apply option defaults', () => {
      expect(panel.state.options.showThresholds).toEqual(true);
    });

    it('should apply fieldConfig defaults', () => {
      expect(panel.state.fieldConfig.defaults.unit).toBe('flop');
      expect(panel.state.fieldConfig.defaults.custom!.customProp).toBe(false);
    });

    it('should should remove props that are not defined for plugin', () => {
      expect(panel.state.fieldConfig.defaults.custom?.junkProp).toEqual(undefined);
    });
  });

  describe('When calling on onPanelMigration', () => {
    const onPanelMigration = jest.fn();
    let panel: VizPanel<OptionsPlugin1, FieldConfigPlugin1>;

    beforeAll(async () => {
      panel = new VizPanel<OptionsPlugin1, FieldConfigPlugin1>({ pluginId: 'custom-plugin-id' });
      pluginToLoad = getTestPlugin1();
      pluginToLoad.onPanelMigration = onPanelMigration;
      panel.activate();
    });

    it('should call onPanelMigration with pluginVersion set to initial state (undefined)', () => {
      expect(onPanelMigration.mock.calls[0][0].pluginVersion).toBe(undefined);
    });
  });
});

import { mockStandardFieldConfigOptions } from 'test/helpers/fieldConfig';

import {
  ConfigOverrideRule,
  FieldColorModeId,
  FieldConfig,
  FieldConfigProperty,
  FieldConfigSource,
  PanelPlugin,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  StandardOptionConfig,
  ThresholdsMode,
} from '@grafana/data';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

import { getPanelOptionsWithDefaults, restoreCustomOverrideRules } from './getPanelOptionsWithDefaults';

standardFieldConfigEditorRegistry.setInit(() => mockStandardFieldConfigOptions());
standardEditorsRegistry.setInit(() => mockStandardFieldConfigOptions());

const pluginA = getPanelPlugin({ id: 'graph' });

pluginA.useFieldConfig({
  useCustomConfig: (builder) => {
    builder.addBooleanSwitch({
      name: 'Hide lines',
      path: 'hideLines',
      defaultValue: false,
    });
  },
});

pluginA.setPanelOptions((builder) => {
  builder.addBooleanSwitch({
    name: 'Show thresholds',
    path: 'showThresholds',
    defaultValue: true,
  });
  builder.addTextInput({
    name: 'Name',
    path: 'name',
    defaultValue: 'hello',
  });
  builder.addNumberInput({
    name: 'Number',
    path: 'number',
    defaultValue: 10,
  });
});

describe('getPanelOptionsWithDefaults', () => {
  describe('When panel plugin has no options', () => {
    it('Should set defaults', () => {
      const result = runScenario({
        plugin: getPanelPlugin({ id: 'graph' }),
        options: {},
        defaults: {},
        overrides: [],
      });

      expect(result).toMatchInlineSnapshot(`
        Object {
          "fieldConfig": Object {
            "defaults": Object {},
            "overrides": Array [],
          },
          "options": Object {},
        }
      `);
    });
  });

  describe('When current options are emtpy', () => {
    it('Should set defaults', () => {
      const result = getPanelOptionsWithDefaults({
        plugin: pluginA,
        currentOptions: {},
        currentFieldConfig: {
          defaults: {},
          overrides: [],
        },
        isAfterPluginChange: false,
      });

      expect(result).toMatchInlineSnapshot(`
        Object {
          "fieldConfig": Object {
            "defaults": Object {
              "custom": Object {
                "hideLines": false,
              },
              "thresholds": Object {
                "mode": "absolute",
                "steps": Array [
                  Object {
                    "color": "green",
                    "value": -Infinity,
                  },
                  Object {
                    "color": "red",
                    "value": 80,
                  },
                ],
              },
            },
            "overrides": Array [],
          },
          "options": Object {
            "name": "hello",
            "number": 10,
            "showThresholds": true,
          },
        }
      `);
    });
  });

  describe('When there are current options and overrides', () => {
    it('Should set defaults', () => {
      const result = getPanelOptionsWithDefaults({
        plugin: pluginA,
        currentOptions: {
          number: 20,
          showThresholds: false,
        },
        currentFieldConfig: {
          defaults: {
            unit: 'bytes',
            decimals: 2,
          },
          overrides: [],
        },
        isAfterPluginChange: true,
      });

      expect(result).toMatchInlineSnapshot(`
        Object {
          "fieldConfig": Object {
            "defaults": Object {
              "custom": Object {
                "hideLines": false,
              },
              "decimals": 2,
              "thresholds": Object {
                "mode": "absolute",
                "steps": Array [
                  Object {
                    "color": "green",
                    "value": -Infinity,
                  },
                  Object {
                    "color": "red",
                    "value": 80,
                  },
                ],
              },
              "unit": "bytes",
            },
            "overrides": Array [],
          },
          "options": Object {
            "name": "hello",
            "number": 20,
            "showThresholds": false,
          },
        }
      `);
    });
  });

  describe('when changing panel type to one that does not support by value color mode', () => {
    it('should change color mode', () => {
      const plugin = getPanelPlugin({ id: 'graph' }).useFieldConfig({
        standardOptions: {
          [FieldConfigProperty.Color]: {
            settings: {
              byValueSupport: false,
            },
          },
        },
      });

      const result = getPanelOptionsWithDefaults({
        plugin,
        currentOptions: {},
        currentFieldConfig: {
          defaults: {
            color: { mode: FieldColorModeId.Thresholds },
          },
          overrides: [],
        },
        isAfterPluginChange: true,
      });

      expect(result.fieldConfig.defaults.color!.mode).toBe(FieldColorModeId.PaletteClassic);
    });
  });

  describe('when changing panel type from one not supporting by value color mode to one that supports it', () => {
    it('should keep supported mode', () => {
      const result = runScenario({
        defaults: {
          color: { mode: FieldColorModeId.PaletteClassic },
        },
        standardOptions: {
          [FieldConfigProperty.Color]: {
            settings: {
              byValueSupport: true,
            },
          },
        },
      });
      expect(result.fieldConfig.defaults.color!.mode).toBe(FieldColorModeId.PaletteClassic);
    });

    it('should change to thresholds mode when it prefers to', () => {
      const result = runScenario({
        defaults: {
          color: { mode: FieldColorModeId.PaletteClassic },
        },
        standardOptions: {
          [FieldConfigProperty.Color]: {
            settings: {
              byValueSupport: true,
              preferThresholdsMode: true,
            },
          },
        },
        isAfterPluginChange: true,
      });
      expect(result.fieldConfig.defaults.color!.mode).toBe(FieldColorModeId.Thresholds);
    });

    it('should change to classic mode when panel supports bySeries', () => {
      const result = runScenario({
        defaults: {
          color: { mode: FieldColorModeId.Thresholds },
        },
        standardOptions: {
          [FieldConfigProperty.Color]: {
            settings: {
              byValueSupport: true,
              bySeriesSupport: true,
            },
          },
        },
        isAfterPluginChange: true,
      });
      expect(result.fieldConfig.defaults.color!.mode).toBe(FieldColorModeId.PaletteClassic);
    });
  });

  describe('when changing panel type to one that does not use standard field config', () => {
    it('should clean defaults', () => {
      const plugin = getPanelPlugin({ id: 'graph' });

      const result = getPanelOptionsWithDefaults({
        plugin,
        currentOptions: {},
        currentFieldConfig: {
          defaults: {
            color: { mode: FieldColorModeId.Thresholds },
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [],
            },
          },
          overrides: [],
        },
        isAfterPluginChange: true,
      });

      expect(result.fieldConfig.defaults.thresholds).toBeUndefined();
    });
  });

  describe('when applying defaults clean properties that are no longer part of the registry', () => {
    it('should remove custom defaults that no longer exist', () => {
      const result = runScenario({
        defaults: {
          unit: 'bytes',
          custom: {
            customProp: 20,
            customPropNoExist: true,
            nested: {
              nestedA: 'A',
              nestedB: 'B',
            },
          },
        },
      });

      expect(result.fieldConfig.defaults).toMatchInlineSnapshot(`
        Object {
          "custom": Object {
            "customProp": 20,
            "nested": Object {
              "nestedA": "A",
            },
          },
          "thresholds": Object {
            "mode": "absolute",
            "steps": Array [
              Object {
                "color": "green",
                "value": -Infinity,
              },
              Object {
                "color": "red",
                "value": 80,
              },
            ],
          },
          "unit": "bytes",
        }
      `);
    });

    it('should remove custom overrides that no longer exist', () => {
      const result = runScenario({
        defaults: {},
        overrides: [
          {
            matcher: { id: 'byName', options: 'D-series' },
            properties: [
              {
                id: 'custom.customPropNoExist',
                value: 'google',
              },
            ],
          },
          {
            matcher: { id: 'byName', options: 'D-series' },
            properties: [
              {
                id: 'custom.customProp',
                value: 30,
              },
            ],
          },
        ],
      });

      expect(result.fieldConfig.overrides.length).toBe(1);
      expect(result.fieldConfig.overrides[0].properties[0].id).toBe('custom.customProp');
    });
  });
});

describe('restoreCustomOverrideRules', () => {
  it('should add back custom rules', () => {
    const current = {
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'SeriesA' },
          properties: [
            {
              id: 'decimals',
              value: 2,
            },
          ],
        },
      ],
    };
    const old = {
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'SeriesA' },
          properties: [
            {
              id: 'custom.propName',
              value: 10,
            },
          ],
        },
        {
          matcher: { id: 'byName', options: 'SeriesB' },
          properties: [
            {
              id: 'custom.propName',
              value: 20,
            },
          ],
        },
      ],
    };

    const result = restoreCustomOverrideRules(current, old);
    expect(result.overrides.length).toBe(2);
    expect(result.overrides[0].properties[0].id).toBe('decimals');
    expect(result.overrides[0].properties[1].id).toBe('custom.propName');
    expect(result.overrides[1].properties.length).toBe(1);
    expect(result.overrides[1].matcher.options).toBe('SeriesB');
  });
});

interface ScenarioOptions {
  defaults?: FieldConfig<any>;
  overrides?: ConfigOverrideRule[];
  disabledStandardOptions?: FieldConfigProperty[];
  standardOptions?: Partial<Record<FieldConfigProperty, StandardOptionConfig>>;
  plugin?: PanelPlugin;
  options?: any;
  isAfterPluginChange?: boolean;
}

function runScenario(options: ScenarioOptions) {
  const fieldConfig: FieldConfigSource = {
    defaults: options.defaults || {},
    overrides: options.overrides || [],
  };

  const plugin =
    options.plugin ??
    getPanelPlugin({ id: 'graph' }).useFieldConfig({
      standardOptions: options.standardOptions,
      useCustomConfig: (builder) => {
        builder.addNumberInput({
          name: 'Custom prop',
          path: 'customProp',
          defaultValue: 10,
        });
        builder.addTextInput({
          name: 'Nested prop',
          path: 'nested.nestedA',
        });
      },
    });

  return getPanelOptionsWithDefaults({
    plugin,
    currentOptions: options.options || {},
    currentFieldConfig: fieldConfig,
    isAfterPluginChange: !!options.isAfterPluginChange,
  });
}

import {
  FieldColorConfigSettings,
  FieldColorModeId,
  FieldConfig,
  FieldConfigProperty,
  FieldConfigSource,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';
import { mockStandardFieldConfigOptions } from 'test/helpers/fieldConfig';
import { getPanelOptionsWithDefaults } from './getPanelOptionsWithDefaults';

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
      const pluginWithNoOptions = getPanelPlugin({ id: 'graph' });
      const result = getPanelOptionsWithDefaults({
        plugin: pluginWithNoOptions,
        currentOptions: {},
        currentFieldConfig: {
          defaults: {},
          overrides: [],
        },
      });

      expect(result).toMatchInlineSnapshot(`
        Object {
          "fieldConfig": Object {
            "defaults": Object {
              "custom": Object {},
            },
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
      });

      expect(result).toMatchInlineSnapshot(`
        Object {
          "fieldConfig": Object {
            "defaults": Object {
              "custom": Object {
                "hideLines": false,
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
            min: 10,
            max: 20,
          },
          overrides: [],
        },
      });

      expect(result).toMatchInlineSnapshot(`
        Object {
          "fieldConfig": Object {
            "defaults": Object {
              "custom": Object {
                "hideLines": false,
              },
              "max": 20,
              "min": 10,
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
      });

      expect(result.fieldConfig.defaults.color!.mode).toBe(FieldColorModeId.PaletteClassic);
    });
  });

  describe('when changing panel type from one not supporting by value color mode to one that supports it', () => {
    const prepareModel = (colorOptions?: FieldColorConfigSettings) => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          color: { mode: FieldColorModeId.PaletteClassic },
        },
        overrides: [],
      };

      const plugin = getPanelPlugin({ id: 'graph' }).useFieldConfig({
        standardOptions: {
          [FieldConfigProperty.Color]: {
            settings: {
              byValueSupport: true,
              ...colorOptions,
            },
          },
        },
      });

      return getPanelOptionsWithDefaults({
        plugin,
        currentOptions: {},
        currentFieldConfig: fieldConfig,
      });
    };

    it('should keep supported mode', () => {
      const testModel = prepareModel();
      expect(testModel.fieldConfig.defaults.color!.mode).toBe(FieldColorModeId.PaletteClassic);
    });

    it('should change to thresholds mode when it prefers to', () => {
      const testModel = prepareModel({ preferThresholdsMode: true });
      expect(testModel.fieldConfig.defaults.color!.mode).toBe(FieldColorModeId.Thresholds);
    });
  });
});

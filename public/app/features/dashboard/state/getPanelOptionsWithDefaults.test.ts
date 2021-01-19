import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';
import { mockStandardFieldConfigOptions } from 'test/helpers/fieldConfig';
import { getPanelOptionsWithDefaults } from './getPanelOptionsWithDefaults';

standardFieldConfigEditorRegistry.setInit(() => mockStandardFieldConfigOptions());
standardEditorsRegistry.setInit(() => mockStandardFieldConfigOptions());

const pluginA = getPanelPlugin({ id: 'graph' });

pluginA.useFieldConfig({});
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
              "custom": Object {},
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
              "custom": Object {},
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
});

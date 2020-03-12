import {
  FieldOverrideEnv,
  findNumericFieldMinMax,
  setFieldConfigDefaults,
  applyFieldOverrides,
} from './fieldOverrides';
import { MutableDataFrame } from '../dataframe';
import {
  FieldConfig,
  FieldConfigEditorRegistry,
  FieldOverrideContext,
  FieldPropertyEditorItem,
  GrafanaTheme,
  FieldType,
} from '../types';
import { Registry } from '../utils';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';

const property1 = {
  id: 'property1', // Match field properties
  process: (value: any) => value,
  shouldApply: () => true,
} as any;

const property2 = {
  id: 'property2', // Match field properties
  process: (value: any) => value,
  shouldApply: () => true,
} as any;

const unit = {
  id: 'unit', // Match field properties
  process: (value: any) => value,
  shouldApply: () => true,
} as any;

export const customFieldRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(() => {
  return [property1, property2];
});

// For the need of this test  we need to mock the standard registry
// as we cannot imporrt from grafana/ui
standardFieldConfigEditorRegistry.setInit(() => {
  return [unit];
});

describe('Global MinMax', () => {
  it('find global min max', () => {
    const f0 = new MutableDataFrame();
    f0.add({ title: 'AAA', value: 100, value2: 1234 }, true);
    f0.add({ title: 'BBB', value: -20 }, true);
    f0.add({ title: 'CCC', value: 200, value2: 1000 }, true);
    expect(f0.length).toEqual(3);

    const minmax = findNumericFieldMinMax([f0]);
    expect(minmax.min).toEqual(-20);
    expect(minmax.max).toEqual(1234);
  });
});

describe('applyFieldOverrides', () => {
  describe('given multiple data frames', () => {
    const f0 = new MutableDataFrame({
      name: 'A',
      fields: [{ name: 'message', type: FieldType.string, values: [10, 20] }],
    });
    const f1 = new MutableDataFrame({
      name: 'B',
      fields: [{ name: 'info', type: FieldType.string, values: [10, 20] }],
    });

    it('should add scopedVars to fields', () => {
      const withOverrides = applyFieldOverrides({
        data: [f0, f1],
        fieldOptions: {
          defaults: {},
          overrides: [],
        },
        replaceVariables: (value: any) => value,
        theme: {} as GrafanaTheme,
      });

      expect(withOverrides[0].fields[0].config.scopedVars).toMatchInlineSnapshot(`
        Object {
          "__field": Object {
            "text": "Field",
            "value": Object {
              "name": "message",
            },
          },
          "__series": Object {
            "text": "Series",
            "value": Object {
              "name": "A",
            },
          },
        }
      `);

      expect(withOverrides[1].fields[0].config.scopedVars).toMatchInlineSnapshot(`
        Object {
          "__field": Object {
            "text": "Field",
            "value": Object {
              "name": "info",
            },
          },
          "__series": Object {
            "text": "Series",
            "value": Object {
              "name": "B",
            },
          },
        }
      `);
    });
  });
});

describe('setFieldConfigDefaults', () => {
  it('applies field config defaults', () => {
    const dsFieldConfig: FieldConfig = {
      decimals: 2,
      min: 0,
      max: 100,
    };

    const panelFieldConfig: FieldConfig = {
      decimals: 1,
      min: 10,
      max: 50,
      unit: 'km',
    };

    const context: FieldOverrideContext = {
      data: [] as any,
      field: { type: FieldType.number } as any,
      dataFrameIndex: 0,
    };

    // we mutate dsFieldConfig
    setFieldConfigDefaults(dsFieldConfig, panelFieldConfig, context);

    expect(dsFieldConfig).toMatchInlineSnapshot(`
      Object {
        "decimals": 2,
        "max": 100,
        "min": 0,
        "unit": "km",
      }
    `);
  });

  it('applies field config defaults for custom properties', () => {
    const dsFieldConfig: FieldConfig = {
      custom: {
        property1: 10,
      },
    };

    const panelFieldConfig: FieldConfig = {
      custom: {
        property1: 20,
        property2: 10,
      },
    };

    const context: FieldOverrideEnv = {
      data: [] as any,
      field: { type: FieldType.number } as any,
      dataFrameIndex: 0,
      custom: customFieldRegistry,
    };

    // we mutate dsFieldConfig
    setFieldConfigDefaults(dsFieldConfig, panelFieldConfig, context);

    expect(dsFieldConfig).toMatchInlineSnapshot(`
      Object {
        "custom": Object {
          "property1": 10,
          "property2": 10,
        },
      }
    `);
  });
});

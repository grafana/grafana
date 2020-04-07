import {
  FieldOverrideEnv,
  findNumericFieldMinMax,
  setFieldConfigDefaults,
  applyFieldOverrides,
} from './fieldOverrides';
import { MutableDataFrame, toDataFrame } from '../dataframe';
import {
  FieldConfig,
  FieldConfigPropertyItem,
  GrafanaTheme,
  FieldType,
  DataFrame,
  FieldConfigSource,
  InterpolateFunction,
} from '../types';
import { Registry } from '../utils';
import { mockStandardProperties } from '../utils/tests/mockStandardProperties';
import { FieldMatcherID } from '../transformations';
import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';

const property1 = {
  id: 'custom.property1', // Match field properties
  path: 'property1', // Match field properties
  isCustom: true,
  process: (value: any) => value,
  shouldApply: () => true,
} as any;

const property2 = {
  id: 'custom.property2', // Match field properties
  path: 'property2', // Match field properties
  isCustom: true,
  process: (value: any) => value,
  shouldApply: () => true,
} as any;

export const customFieldRegistry: FieldConfigOptionsRegistry = new Registry<FieldConfigPropertyItem>(() => {
  return [property1, property2, ...mockStandardProperties()];
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
  const f0 = new MutableDataFrame();
  f0.add({ title: 'AAA', value: 100, value2: 1234 }, true);
  f0.add({ title: 'BBB', value: -20 }, true);
  f0.add({ title: 'CCC', value: 200, value2: 1000 }, true);
  expect(f0.length).toEqual(3);

  // Hardcode the max value
  f0.fields[1].config.max = 0;
  f0.fields[1].config.decimals = 6;

  const src: FieldConfigSource = {
    defaults: {
      unit: 'xyz',
      decimals: 2,
    },
    overrides: [
      {
        matcher: { id: FieldMatcherID.numeric },
        properties: [
          { id: 'decimals', value: 1 }, // Numeric
          { id: 'title', value: 'Kittens' }, // Text
        ],
      },
    ],
  };

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
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        replaceVariables: (value: any) => value,
        theme: {} as GrafanaTheme,
        fieldConfigRegistry: new FieldConfigOptionsRegistry(),
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

  it('will merge FieldConfig with default values', () => {
    const field: FieldConfig = {
      min: 0,
      max: 100,
    };
    const f1 = {
      unit: 'ms',
      dateFormat: '', // should be ignored
      max: parseFloat('NOPE'), // should be ignored
      min: null, // should alo be ignored!
    };

    const f: DataFrame = toDataFrame({
      fields: [{ type: FieldType.number, name: 'x', config: field, values: [] }],
    });
    const processed = applyFieldOverrides({
      data: [f],
      fieldConfig: {
        defaults: f1 as FieldConfig,
        overrides: [],
      },
      fieldConfigRegistry: customFieldRegistry,
      replaceVariables: v => v,
      theme: {} as GrafanaTheme,
    })[0];
    const out = processed.fields[0].config;

    expect(out.min).toEqual(0);
    expect(out.max).toEqual(100);
    expect(out.unit).toEqual('ms');
  });

  it('will apply field overrides', () => {
    const data = applyFieldOverrides({
      data: [f0], // the frame
      fieldConfig: src as FieldConfigSource, // defaults + overrides
      replaceVariables: (undefined as any) as InterpolateFunction,
      theme: (undefined as any) as GrafanaTheme,
      fieldConfigRegistry: customFieldRegistry,
    })[0];
    const valueColumn = data.fields[1];
    const config = valueColumn.config;

    // Keep max from the original setting
    expect(config.max).toEqual(0);

    // Don't Automatically pick the min value
    expect(config.min).toEqual(undefined);

    // The default value applied
    expect(config.unit).toEqual('xyz');

    // The default value applied
    expect(config.title).toEqual('Kittens');

    // The override applied
    expect(config.decimals).toEqual(1);
  });

  it('will apply set min/max when asked', () => {
    const data = applyFieldOverrides({
      data: [f0], // the frame
      fieldConfig: src as FieldConfigSource, // defaults + overrides
      replaceVariables: (undefined as any) as InterpolateFunction,
      theme: (undefined as any) as GrafanaTheme,
      autoMinMax: true,
    })[0];
    const valueColumn = data.fields[1];
    const config = valueColumn.config;

    // Keep max from the original setting
    expect(config.max).toEqual(0);

    // Don't Automatically pick the min value
    expect(config.min).toEqual(-20);
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

    const context: FieldOverrideEnv = {
      data: [] as any,
      field: { type: FieldType.number } as any,
      dataFrameIndex: 0,
      fieldConfigRegistry: customFieldRegistry,
    };

    // we mutate dsFieldConfig
    setFieldConfigDefaults(dsFieldConfig, panelFieldConfig, context);

    expect(dsFieldConfig).toMatchInlineSnapshot(`
      Object {
        "custom": Object {},
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
      fieldConfigRegistry: customFieldRegistry,
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

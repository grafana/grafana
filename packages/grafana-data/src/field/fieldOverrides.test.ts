import { FieldOverrideEnv, findNumericFieldMinMax, setFieldConfigDefaults } from './fieldOverrides';
import { MutableDataFrame } from '../dataframe';
import {
  FieldConfig,
  FieldConfigEditorRegistry,
  FieldOverrideContext,
  FieldPropertyEditorItem,
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

    console.log(standardFieldConfigEditorRegistry);
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

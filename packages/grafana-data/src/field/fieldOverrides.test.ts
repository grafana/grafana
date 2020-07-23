import {
  FieldOverrideEnv,
  findNumericFieldMinMax,
  setFieldConfigDefaults,
  setDynamicConfigValue,
  applyFieldOverrides,
  getLinksSupplier,
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
import { getFieldDisplayName } from './fieldState';
import { locationUtil } from '../utils';

const property1: any = {
  id: 'custom.property1', // Match field properties
  path: 'property1', // Match field properties
  isCustom: true,
  process: (value: any) => value,
  shouldApply: () => true,
};

const property2 = {
  id: 'custom.property2', // Match field properties
  path: 'property2', // Match field properties
  isCustom: true,
  process: (value: any) => value,
  shouldApply: () => true,
};

const property3: any = {
  id: 'custom.property3.nested', // Match field properties
  path: 'property3.nested', // Match field properties
  isCustom: true,
  process: (value: any) => value,
  shouldApply: () => true,
};

const shouldApplyFalse: any = {
  id: 'custom.shouldApplyFalse', // Match field properties
  path: 'shouldApplyFalse', // Match field properties
  isCustom: true,
  process: (value: any) => value,
  shouldApply: () => false,
};

export const customFieldRegistry: FieldConfigOptionsRegistry = new Registry<FieldConfigPropertyItem>(() => {
  return [property1, property2, property3, shouldApplyFalse, ...mockStandardProperties()];
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
          { id: 'displayName', value: 'Kittens' }, // Text
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
        getDataSourceSettingsByUid: undefined as any,
        theme: {} as GrafanaTheme,
        fieldConfigRegistry: new FieldConfigOptionsRegistry(),
      });

      expect(withOverrides[0].fields[0].state!.scopedVars).toMatchInlineSnapshot(`
        Object {
          "__field": Object {
            "text": "Field",
            "value": Object {
              "formattedLabels": "",
              "labels": undefined,
              "name": "A message",
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

      expect(withOverrides[1].fields[0].state!.scopedVars).toMatchInlineSnapshot(`
        Object {
          "__field": Object {
            "text": "Field",
            "value": Object {
              "formattedLabels": "",
              "labels": undefined,
              "name": "B info",
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
      displayName: 'newTitle',
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
      getDataSourceSettingsByUid: undefined as any,
      replaceVariables: v => v,
      theme: {} as GrafanaTheme,
    })[0];

    const outField = processed.fields[0];

    expect(outField.config.min).toEqual(0);
    expect(outField.config.max).toEqual(100);
    expect(outField.config.unit).toEqual('ms');
    expect(getFieldDisplayName(outField, f)).toEqual('newTitle');
  });

  it('will apply field overrides', () => {
    const data = applyFieldOverrides({
      data: [f0], // the frame
      fieldConfig: src as FieldConfigSource, // defaults + overrides
      replaceVariables: (undefined as any) as InterpolateFunction,
      getDataSourceSettingsByUid: undefined as any,
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
    expect(config.displayName).toEqual('Kittens');

    // The override applied
    expect(config.decimals).toEqual(1);
  });

  it('will apply set min/max when asked', () => {
    const data = applyFieldOverrides({
      data: [f0], // the frame
      fieldConfig: src as FieldConfigSource, // defaults + overrides
      replaceVariables: (undefined as any) as InterpolateFunction,
      getDataSourceSettingsByUid: undefined as any,
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

describe('setDynamicConfigValue', () => {
  it('applies dynamic config values', () => {
    const config = {
      displayName: 'test',
    };

    setDynamicConfigValue(
      config,
      {
        id: 'displayName',
        value: 'applied',
      },
      {
        fieldConfigRegistry: customFieldRegistry,
        data: [] as any,
        field: { type: FieldType.number } as any,
        dataFrameIndex: 0,
      }
    );

    expect(config.displayName).toEqual('applied');
  });

  it('applies custom dynamic config values', () => {
    const config = {
      custom: {
        property1: 1,
      },
    };
    setDynamicConfigValue(
      config,
      {
        id: 'custom.property1',
        value: 'applied',
      },
      {
        fieldConfigRegistry: customFieldRegistry,
        data: [] as any,
        field: { type: FieldType.number } as any,
        dataFrameIndex: 0,
      }
    );

    expect(config.custom.property1).toEqual('applied');
  });

  it('applies overrides even when shouldApply returns false', () => {
    const config: FieldConfig = {
      custom: {},
    };
    setDynamicConfigValue(
      config,
      {
        id: 'custom.shouldApplyFalse',
        value: 'applied',
      },
      {
        fieldConfigRegistry: customFieldRegistry,
        data: [] as any,
        field: { type: FieldType.number } as any,
        dataFrameIndex: 0,
      }
    );

    expect(config.custom.shouldApplyFalse).toEqual('applied');
  });

  it('applies nested custom dynamic config values', () => {
    const config = {
      custom: {
        property3: {
          nested: 1,
        },
      },
    };
    setDynamicConfigValue(
      config,
      {
        id: 'custom.property3.nested',
        value: 'applied',
      },
      {
        fieldConfigRegistry: customFieldRegistry,
        data: [] as any,
        field: { type: FieldType.number } as any,
        dataFrameIndex: 0,
      }
    );

    expect(config.custom.property3.nested).toEqual('applied');
  });

  it('removes properties', () => {
    const config = {
      displayName: 'title',
      custom: {
        property3: {
          nested: 1,
        },
      },
    };
    setDynamicConfigValue(
      config,
      {
        id: 'custom.property3.nested',
        value: undefined,
      },
      {
        fieldConfigRegistry: customFieldRegistry,
        data: [] as any,
        field: { type: FieldType.number } as any,
        dataFrameIndex: 0,
      }
    );

    setDynamicConfigValue(
      config,
      {
        id: 'displayName',
        value: undefined,
      },
      {
        fieldConfigRegistry: customFieldRegistry,
        data: [] as any,
        field: { type: FieldType.number } as any,
        dataFrameIndex: 0,
      }
    );

    expect(config.custom.property3).toEqual({});
    expect(config.displayName).toBeUndefined();
  });
});

describe('getLinksSupplier', () => {
  it('will replace variables in url and title of the data link', () => {
    locationUtil.initialize({
      getConfig: () => ({} as any),
      buildParamsFromVariables: (() => {}) as any,
      getTimeRangeForUrl: (() => {}) as any,
    });

    const f0 = new MutableDataFrame({
      name: 'A',
      fields: [
        {
          name: 'message',
          type: FieldType.string,
          values: [10, 20],
          config: {
            links: [
              {
                url: 'url to be interpolated',
                title: 'title to be interpolated',
              },
            ],
          },
        },
      ],
    });

    const replaceSpy = jest.fn();
    const supplier = getLinksSupplier(
      f0,
      f0.fields[0],
      {},
      replaceSpy,
      // this is used only for internal links so isn't needed here
      () => ({} as any),
      {
        theme: {} as GrafanaTheme,
      }
    );
    supplier({});

    expect(replaceSpy).toBeCalledTimes(2);
    expect(replaceSpy.mock.calls[0][0]).toEqual('url to be interpolated');
    expect(replaceSpy.mock.calls[1][0]).toEqual('title to be interpolated');
  });

  it('handles internal links', () => {
    locationUtil.initialize({
      getConfig: () => ({ appSubUrl: '' } as any),
      buildParamsFromVariables: (() => {}) as any,
      getTimeRangeForUrl: (() => {}) as any,
    });

    const f0 = new MutableDataFrame({
      name: 'A',
      fields: [
        {
          name: 'message',
          type: FieldType.string,
          values: [10, 20],
          config: {
            links: [
              {
                url: '',
                title: '',
                internal: {
                  datasourceUid: '0',
                  query: '12345',
                },
              },
            ],
          },
        },
      ],
    });

    const supplier = getLinksSupplier(
      f0,
      f0.fields[0],
      {},
      // We do not need to interpolate anything for this test
      (value, vars, format) => value,
      uid => ({ name: 'testDS' } as any),
      { theme: {} as GrafanaTheme }
    );
    const links = supplier({ valueRowIndex: 0 });
    expect(links.length).toBe(1);
    expect(links[0]).toEqual(
      expect.objectContaining({
        title: 'testDS',
        href:
          '/explore?left={"datasource":"testDS","queries":["12345"],"ui":{"showingGraph":true,"showingTable":true,"showingLogs":true}}',
        onClick: undefined,
      })
    );
  });
});

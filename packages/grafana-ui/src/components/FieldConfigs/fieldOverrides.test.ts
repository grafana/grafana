import {
  FieldConfig,
  FieldConfigSource,
  InterpolateFunction,
  GrafanaTheme,
  FieldMatcherID,
  MutableDataFrame,
  DataFrame,
  FieldType,
  applyFieldOverrides,
  toDataFrame,
  standardFieldConfigEditorRegistry,
  standardEditorsRegistry,
} from '@grafana/data';

import { getTheme } from '../../themes';
import { getStandardFieldConfigs, getStandardOptionEditors } from '../../utils';

describe('FieldOverrides', () => {
  beforeAll(() => {
    standardEditorsRegistry.setInit(getStandardOptionEditors);
    standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
  });

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
          { prop: 'decimals', value: 1 }, // Numeric
          { prop: 'title', value: 'Kittens' }, // Text
        ],
      },
    ],
  };

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
      standard: standardFieldConfigEditorRegistry,
      fieldOptions: {
        defaults: f1 as FieldConfig,
        overrides: [],
      },
      replaceVariables: v => v,
      theme: getTheme(),
    })[0];
    const out = processed.fields[0].config;

    expect(out.min).toEqual(0);
    expect(out.max).toEqual(100);
    expect(out.unit).toEqual('ms');
  });

  it('will apply field overrides', () => {
    const data = applyFieldOverrides({
      data: [f0], // the frame
      fieldOptions: src as FieldConfigSource, // defaults + overrides
      replaceVariables: (undefined as any) as InterpolateFunction,
      theme: (undefined as any) as GrafanaTheme,
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
      fieldOptions: src as FieldConfigSource, // defaults + overrides
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

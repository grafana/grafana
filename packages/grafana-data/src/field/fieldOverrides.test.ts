import { setFieldConfigDefaults, findNumericFieldMinMax, applyFieldOverrides } from './fieldOverrides';
import { MutableDataFrame } from '../dataframe';
import { FieldConfig, FieldConfigSource, InterpolateFunction, GrafanaTheme } from '../types';
import { FieldMatcherID } from '../transformations';
import { FieldDisplayOptions } from './fieldDisplay';

describe('FieldOverrides', () => {
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
          { path: 'decimals', value: 1 }, // Numeric
          { path: 'title', value: 'Kittens' }, // Text
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
    setFieldConfigDefaults(field, f1 as FieldConfig);
    expect(field.min).toEqual(0);
    expect(field.max).toEqual(100);
    expect(field.unit).toEqual('ms');
  });

  it('will apply field overrides', () => {
    const data = applyFieldOverrides({
      data: [f0], // the frame
      fieldOptions: src as FieldDisplayOptions, // defaults + overrides
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
      fieldOptions: src as FieldDisplayOptions, // defaults + overrides
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

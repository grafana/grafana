import { getFieldProperties, getFieldDisplayValues, GetFieldDisplayValuesOptions } from './fieldDisplay';
import { ReducerID, Threshold, toDataFrame } from '@grafana/data';
import { GrafanaThemeType } from '../types/theme';
import { getTheme } from '../themes/index';

describe('FieldDisplay', () => {
  it('Construct simple field properties', () => {
    const f0 = {
      min: 0,
      max: 100,
    };
    const f1 = {
      unit: 'ms',
      dateFormat: '', // should be ignored
      max: parseFloat('NOPE'), // should be ignored
      min: null,
    };
    let field = getFieldProperties(f0, f1);
    expect(field.min).toEqual(0);
    expect(field.max).toEqual(100);
    expect(field.unit).toEqual('ms');

    // last one overrieds
    const f2 = {
      unit: 'none', // ignore 'none'
      max: -100, // lower than min! should flip min/max
    };
    field = getFieldProperties(f0, f1, f2);
    expect(field.max).toEqual(0);
    expect(field.min).toEqual(-100);
    expect(field.unit).toEqual('ms');
  });

  // Simple test dataset
  const options: GetFieldDisplayValuesOptions = {
    data: [
      toDataFrame({
        name: 'Series Name',
        fields: [
          { name: 'Field 1', values: ['a', 'b', 'c'] },
          { name: 'Field 2', values: [1, 3, 5] },
          { name: 'Field 3', values: [2, 4, 6] },
        ],
      }),
    ],
    replaceVariables: (value: string) => {
      return value; // Return it unchanged
    },
    fieldOptions: {
      calcs: [],
      override: {},
      defaults: {},
    },
    theme: getTheme(GrafanaThemeType.Dark),
  };

  it('show first numeric values', () => {
    const display = getFieldDisplayValues({
      ...options,
      fieldOptions: {
        calcs: [ReducerID.first],
        override: {},
        defaults: {
          title: '$__cell_0 * $__field_name * $__series_name',
        },
      },
    });
    expect(display.map(v => v.display.text)).toEqual(['1', '2']);
    // expect(display.map(v => v.display.title)).toEqual([
    //   'a * Field 1 * Series Name', // 0
    //   'b * Field 2 * Series Name', // 1
    // ]);
  });

  it('show last numeric values', () => {
    const display = getFieldDisplayValues({
      ...options,
      fieldOptions: {
        calcs: [ReducerID.last],
        override: {},
        defaults: {},
      },
    });
    expect(display.map(v => v.display.numeric)).toEqual([5, 6]);
  });

  it('show all numeric values', () => {
    const display = getFieldDisplayValues({
      ...options,
      fieldOptions: {
        values: true, //
        limit: 1000,
        calcs: [],
        override: {},
        defaults: {},
      },
    });
    expect(display.map(v => v.display.numeric)).toEqual([1, 3, 5, 2, 4, 6]);
  });

  it('show 2 numeric values (limit)', () => {
    const display = getFieldDisplayValues({
      ...options,
      fieldOptions: {
        values: true, //
        limit: 2,
        calcs: [],
        override: {},
        defaults: {},
      },
    });
    expect(display.map(v => v.display.numeric)).toEqual([1, 3]); // First 2 are from the first field
  });

  it('should restore -Infinity value for base threshold', () => {
    const field = getFieldProperties({
      thresholds: [
        ({
          color: '#73BF69',
          value: null,
        } as unknown) as Threshold,
        {
          color: '#F2495C',
          value: 50,
        },
      ],
    });
    expect(field.thresholds!.length).toEqual(2);
    expect(field.thresholds![0].value).toBe(-Infinity);
  });

  it('Should return field thresholds when there is no data', () => {
    const options: GetFieldDisplayValuesOptions = {
      data: [
        {
          name: 'No data',
          fields: [],
          length: 0,
        },
      ],
      replaceVariables: (value: string) => {
        return value;
      },
      fieldOptions: {
        calcs: [],
        override: {},
        defaults: {
          thresholds: [{ color: '#F2495C', value: 50 }],
        },
      },
      theme: getTheme(GrafanaThemeType.Dark),
    };

    const display = getFieldDisplayValues(options);
    expect(display[0].field.thresholds!.length).toEqual(1);
  });
});

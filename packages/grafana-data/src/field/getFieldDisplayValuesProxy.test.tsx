import { createDataFrame, toDataFrame } from '../dataframe';
import { createTheme } from '../themes';

import { applyFieldOverrides } from './fieldOverrides';
import { getFieldDisplayValuesProxy } from './getFieldDisplayValuesProxy';

describe('getFieldDisplayValuesProxy', () => {
  const shortTimeField = [{ name: 'Time', values: [1, 2, 3] }];

  const longTimeField = [{ name: 'Time', values: [1000, 2000, 61000] }];

  const dataFields = [
    {
      name: 'power',
      values: [100, 200, 300],
      labels: {
        name: 'POWAH!',
      },
      config: {
        displayName: 'The Power',
      },
    },
    { name: 'Last', values: ['a', 'b', 'c'] },
  ];

  const overrides = {
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (val: string) => val,
    timeZone: 'utc',
    theme: createTheme(),
  };

  const dataShortTimeRange = applyFieldOverrides({
    ...{ data: [toDataFrame({ fields: [...shortTimeField, ...dataFields] })] },
    ...overrides,
  })[0];

  const dataLongTimeRange = applyFieldOverrides({
    ...{ data: [toDataFrame({ fields: [...longTimeField, ...dataFields] })] },
    ...overrides,
  })[0];

  it('should define all display functions', () => {
    // Field display should be set
    for (const field of dataShortTimeRange.fields) {
      expect(field.display).toBeDefined();
    }
  });

  it('should format the time values in UTC with ms when time range is minute or less', () => {
    // Test Proxies in general
    const p = getFieldDisplayValuesProxy({ frame: dataShortTimeRange, rowIndex: 0 });
    const time = p.Time;
    expect(time.numeric).toEqual(1);
    expect(time.text).toEqual('1970-01-01 00:00:00.001');

    // Should get to the same values by name or index
    const time2 = p[0];
    expect(time2.toString()).toEqual(time.toString());
  });

  it('should format the time values in UTC without ms when time range is over a minute', () => {
    const p = getFieldDisplayValuesProxy({ frame: dataLongTimeRange, rowIndex: 0 });
    const time = p.Time;
    expect(time.text).toEqual('1970-01-01 00:00:01');
  });

  it('Lookup by name, index, or displayName', () => {
    const p = getFieldDisplayValuesProxy({ frame: dataShortTimeRange, rowIndex: 2 });
    expect(p.power.numeric).toEqual(300);
    expect(p['power'].numeric).toEqual(300);
    expect(p['POWAH!'].numeric).toEqual(300);
    expect(p['The Power'].numeric).toEqual(300);
    expect(p[1].numeric).toEqual(300);
  });

  it('should return undefined when missing', () => {
    const p = getFieldDisplayValuesProxy({ frame: dataShortTimeRange, rowIndex: 0 });
    expect(p.xyz).toBeUndefined();
    expect(p[100]).toBeUndefined();
  });

  it('should use default display processor if display is not defined', () => {
    const p = getFieldDisplayValuesProxy({
      frame: createDataFrame({ fields: [{ name: 'test', values: [1, 2] }] }),
      rowIndex: 0,
    });
    expect(p.test.text).toBe('1');
    expect(p.test.numeric).toBe(1);
    expect(p.test.toString()).toBe('1');
  });
});

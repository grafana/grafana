import { setFieldConfigDefaults, findNumericFieldMinMax } from './fieldOverrides';
import { MutableDataFrame } from '../dataframe';
import { FieldConfig } from '../types';

describe('FieldOverrides', () => {
  it('Construct simple field properties', () => {
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

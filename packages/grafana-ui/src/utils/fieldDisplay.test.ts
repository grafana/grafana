import { getFieldProperties } from './fieldDisplay';

describe('FieldDisplay', () => {
  it('Construct simple field properties', () => {
    const f0 = {
      min: 0,
      max: 100,
      dateFormat: 'YYYY',
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
    expect(field.dateFormat).toEqual('YYYY');

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
});

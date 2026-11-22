import { getReportableOptionValue } from './getReportableOptionValue';

const selectSettings = {
  options: [
    { value: 'bottom', label: 'Bottom' },
    { value: 'right', label: 'Right' },
  ],
};

describe('getReportableOptionValue', () => {
  it.each([
    { name: 'true', value: true, expected: { value: 'true', value_type: 'boolean' } },
    { name: 'false', value: false, expected: { value: 'false', value_type: 'boolean' } },
    { name: 'a number', value: 42, expected: { value: '42', value_type: 'number' } },
    { name: 'zero', value: 0, expected: { value: '0', value_type: 'number' } },
  ])('reports $name as a value', ({ value, expected }) => {
    expect(getReportableOptionValue(value, undefined)).toEqual(expected);
  });

  it('reports a string chosen from the editor choices', () => {
    expect(getReportableOptionValue('right', selectSettings)).toEqual({ value: '"right"', value_type: 'string' });
  });

  it.each([
    { name: 'a typed string with no choices', value: 'my secret note', settings: undefined },
    { name: 'a typed string that is not one of the choices', value: 'custom value', settings: selectSettings },
    { name: 'a string when choices are not a list', value: 'bottom', settings: { options: 'bottom' } },
    { name: 'a string when choices have no value', value: 'bottom', settings: { options: [{ label: 'bottom' }] } },
  ])('omits the value for $name', ({ value, settings }) => {
    expect(getReportableOptionValue(value, settings)).toEqual({ value_type: 'string' });
  });

  it.each([
    { name: 'an object', value: { mode: 'absolute', steps: [] }, value_type: 'object' },
    { name: 'an array', value: ['A', 'B'], value_type: 'array' },
    { name: 'null', value: null, value_type: 'null' },
    { name: 'undefined', value: undefined, value_type: 'undefined' },
  ])('omits the value and reports the type for $name', ({ value, value_type }) => {
    expect(getReportableOptionValue(value, selectSettings)).toEqual({ value_type });
  });
});

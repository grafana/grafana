import { required } from './required';

describe('validators :: required', () => {
  it('returns an error if the input is falsy', () => {
    expect(required('123')).toEqual(undefined);
    expect(required('test123')).toEqual(undefined);
    expect(required('test')).toEqual(undefined);
    expect(required(123)).toEqual(undefined);
    expect(required('')).toEqual('Required field');
    expect(required(undefined)).toEqual('Required field');
    expect(required(null)).toEqual('Required field');
    expect(required(0)).toEqual('Required field');
  });
});

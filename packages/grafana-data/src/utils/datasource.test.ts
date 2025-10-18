import { isDataSourceRef } from './datasource';

describe('isDataSourceRef', () => {
  it('returns true for DataSourceRef with only a uid', () => {
    const ref = { uid: '123', type: 'prometheus' };
    expect(isDataSourceRef(ref)).toBe(true);
  });

  it('returns true for DataSourceRef with only a type', () => {
    const ref = { type: 'prometheus' };
    expect(isDataSourceRef(ref)).toBe(true);
  });

  it('returns true for DataSourceRef with both a uid and a type', () => {
    const ref = { uid: '123', type: 'prometheus' };
    expect(isDataSourceRef(ref)).toBe(true);
  });

  it.each(['prometheus', null, undefined, {}, 123])('returns false for %s', (input) => {
    expect(isDataSourceRef(input)).toBe(false);
  });
});

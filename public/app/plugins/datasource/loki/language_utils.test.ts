import { isBytesString } from './language_utils';

describe('isBytesString', () => {
  it('correctly matches bytes string with integers', () => {
    expect(isBytesString('500b')).toBe(true);
    expect(isBytesString('2TB')).toBe(true);
  });
  it('correctly matches bytes string with float', () => {
    expect(isBytesString('500.4kib')).toBe(true);
    expect(isBytesString('10.4654Mib')).toBe(true);
  });
  it('does not match integer without unit', () => {
    expect(isBytesString('500')).toBe(false);
    expect(isBytesString('10')).toBe(false);
  });
  it('does not match float without unit', () => {
    expect(isBytesString('50.047')).toBe(false);
    expect(isBytesString('1.234')).toBe(false);
  });
});

import { toHex, toHex0x } from './arithmeticFormatters';
import { formattedValueToString } from './valueFormats';

describe('hex', () => {
  it('positive integer', () => {
    const str = toHex(100, 0);
    expect(formattedValueToString(str)).toBe('64');
  });
  it('negative integer', () => {
    const str = toHex(-100, 0);
    expect(formattedValueToString(str)).toBe('-64');
  });
  it('positive float', () => {
    const str = toHex(50.52, 1);
    expect(formattedValueToString(str)).toBe('32.8');
  });
  it('negative float', () => {
    const str = toHex(-50.333, 2);
    expect(formattedValueToString(str)).toBe('-32.547AE147AE14');
  });
});

describe('hex 0x', () => {
  it('positive integeter', () => {
    const str = toHex0x(7999, 0);
    expect(formattedValueToString(str)).toBe('0x1F3F');
  });
  it('negative integer', () => {
    const str = toHex0x(-584, 0);
    expect(formattedValueToString(str)).toBe('-0x248');
  });

  it('positive float', () => {
    const str = toHex0x(74.443, 3);
    expect(formattedValueToString(str)).toBe('0x4A.716872B020C4');
  });
  it('negative float', () => {
    const str = toHex0x(-65.458, 1);
    expect(formattedValueToString(str)).toBe('-0x41.8');
  });
});

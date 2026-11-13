import { getProfilePercentage, getProfileValueData } from './utils';

describe('getProfilePercentage', () => {
  it('should round percentages to two decimal places', () => {
    expect(getProfilePercentage({ value: 1, total: 3 })).toBe(33.33);
    expect(getProfilePercentage({ value: 1, total: 32 })).toBe(3.13);
  });

  it('should return zero for a nonpositive total', () => {
    expect(getProfilePercentage({ value: 0, total: 0 })).toBe(0);
    expect(getProfilePercentage({ value: 10, total: 0 })).toBe(0);
    expect(getProfilePercentage({ value: 10, total: -1 })).toBe(0);
  });

  it('should return percentages above 100 when the value exceeds the total', () => {
    expect(getProfilePercentage({ value: 150, total: 100 })).toBe(150);
  });
});

describe('getProfileValueData', () => {
  it('should calculate from raw numeric magnitude rather than scaled text', () => {
    expect(
      getProfileValueData({
        displayValue: { numeric: 2048, text: '2', suffix: ' KiB' },
        totalTicks: 4096,
      })
    ).toEqual({ unitValue: '2 KiB', percentage: 50 });
  });

  it('should format a value without a suffix', () => {
    expect(
      getProfileValueData({
        displayValue: { numeric: 1, text: '1' },
        totalTicks: 3,
      })
    ).toEqual({ unitValue: '1', percentage: 33.33 });
  });
});

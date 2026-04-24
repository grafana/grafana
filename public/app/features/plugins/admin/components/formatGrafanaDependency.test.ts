import { formatGrafanaDependency } from './formatGrafanaDependency';

describe('formatGrafanaDependency', () => {
  it('returns N/A for null', () => {
    expect(formatGrafanaDependency(null)).toBe('N/A');
  });

  it('returns N/A for empty string', () => {
    expect(formatGrafanaDependency('')).toBe('N/A');
  });

  it('formats simple gte range', () => {
    expect(formatGrafanaDependency('>=8.0.0')).toBe('8.0.0 or later');
  });

  it('formats gte with non-zero minor', () => {
    expect(formatGrafanaDependency('>=9.1.0')).toBe('9.1.0 or later');
  });

  it('formats gte with non-zero patch', () => {
    expect(formatGrafanaDependency('>=8.5.20')).toBe('8.5.20 or later');
  });

  it('formats bounded range', () => {
    expect(formatGrafanaDependency('>=8.5.20 <9.0.0')).toBe('8.5.20 – 9.0.0');
  });

  it('formats bounded range with shorthand upper bound', () => {
    expect(formatGrafanaDependency('>=8.0.0 <9')).toBe('8.0.0 – 9.0.0');
  });

  it('formats complex OR range', () => {
    expect(formatGrafanaDependency('>= 8.5.20 < 9 || >= 9.1.0')).toBe('8.5.20 – 9.0.0, 9.1.0 or later');
  });

  it('formats multiple bounded ranges', () => {
    expect(formatGrafanaDependency('>=8.0.0 <9.0.0 || >=9.1.0 <10.0.0')).toBe('8.0.0 – 9.0.0, 9.1.0 – 10.0.0');
  });

  it('formats many adjacent bounded ranges', () => {
    expect(
      formatGrafanaDependency('>=11.6.11 <12.0.0 || >=12.0.10 <12.1.0 || >=12.1.7 <12.2.0 || >=12.2.5 <14.0.0')
    ).toBe('11.6.11 – 12.0.0, 12.0.10 – 12.1.0, 12.1.7 – 12.2.0, 12.2.5 – 14.0.0');
  });

  it('falls back to raw string on parse error', () => {
    expect(formatGrafanaDependency('not-a-range')).toBe('not-a-range');
  });
});

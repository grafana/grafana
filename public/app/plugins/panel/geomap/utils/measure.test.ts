import { type FormattedValue, formattedValueToString } from '@grafana/data';

import { measures } from './measure';

/** First decimal number in a formatted measure string (handles spaces, suffixes). */
function numericPart(fv: FormattedValue): number {
  const s = formattedValueToString(fv).replace(/,/g, '');
  const match = s.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return Number.NaN;
  }
  return parseFloat(match[0]);
}

describe('map measure tools (length / area units)', () => {
  const length = measures[0];
  const area = measures[1];

  it('should expose length geometry and units documented for measure tools', () => {
    expect(length.geometry).toBe('LineString');
    expect(length.units.map((u) => u.value)).toEqual(['m', 'ft', 'mi', 'nmi']);
  });

  it('should expose area geometry and units documented for measure tools', () => {
    expect(area.geometry).toBe('Polygon');
    expect(area.units.map((u) => u.value)).toEqual(['m2', 'km2', 'ft2', 'mi2', 'acre2', 'hectare2']);
  });

  it('should map area-prefixed unit codes to length when reading length measure', () => {
    expect(length.value).toBe('length');
    expect(length.getUnit('ft').value).toBe('ft');
    expect(length.getUnit('ft2').value).toBe('ft');
  });

  it('should normalize length unit codes to area when reading area measure', () => {
    expect(area.value).toBe('area');
    expect(area.getUnit('ft2').value).toBe('ft2');
    expect(area.getUnit('ft').value).toBe('ft2');
  });

  it('should fall back to metric defaults when unit is unknown', () => {
    expect(length.getUnit('does-not-exist').value).toBe('m');
    expect(area.getUnit('does-not-exist').value).toBe('m2');
  });
});

describe('map measure formatters (SI → displayed unit)', () => {
  const length = measures[0];
  const area = measures[1];

  it('should convert length from meters to nautical miles (1852 m ≈ 1 nmi)', () => {
    const nmi = length.units.find((u) => u.value === 'nmi')!;
    expect(numericPart(nmi.format(1852))).toBeCloseTo(1, 2);
  });

  it('should convert length from meters to statute miles (1609 m ≈ 1 mi)', () => {
    const mi = length.units.find((u) => u.value === 'mi')!;
    expect(numericPart(mi.format(1609))).toBeCloseTo(1, 2);
  });

  it('should convert length from meters to feet (1 m ≈ 3.28 ft)', () => {
    const ft = length.units.find((u) => u.value === 'ft')!;
    expect(numericPart(ft.format(1))).toBeCloseTo(3.28084, 2);
  });

  it('should pass through length in meters for the metric formatter', () => {
    const m = length.units.find((u) => u.value === 'm')!;
    expect(numericPart(m.format(42))).toBeCloseTo(42, 5);
  });

  it('should pass through area in m² for the square-meter formatter', () => {
    const m2 = area.units.find((u) => u.value === 'm2')!;
    expect(numericPart(m2.format(123))).toBeCloseTo(123, 3);
  });

  it('should convert area from m² to km² (1e6 m² = 1 km²)', () => {
    const km2 = area.units.find((u) => u.value === 'km2')!;
    expect(numericPart(km2.format(1_000_000))).toBeCloseTo(1, 5);
  });

  it('should convert area from m² to hectares (10 000 m² = 1 ha)', () => {
    const ha = area.units.find((u) => u.value === 'hectare2')!;
    expect(numericPart(ha.format(10_000))).toBeCloseTo(1, 5);
  });

  it('should convert area from m² to square feet using the scale factor', () => {
    const ft2 = area.units.find((u) => u.value === 'ft2')!;
    // 1 m² × 10.76391 → ft²; value formatter rounds for display (~10.8).
    expect(numericPart(ft2.format(1))).toBeCloseTo(10.76391, 0);
  });

  it('should convert area from m² to square miles at a scale where the primary value is ~1 mi²', () => {
    const mi2 = area.units.find((u) => u.value === 'mi2')!;
    const m2PerMi2 = 1 / 3.861e-7;
    expect(numericPart(mi2.format(m2PerMi2))).toBeCloseTo(1, 0);
  });

  it('should convert area from m² to acres (10 000 m² ≈ 2.47 ac)', () => {
    const acre = area.units.find((u) => u.value === 'acre2')!;
    expect(numericPart(acre.format(10_000))).toBeCloseTo(2.47105, 1);
  });
});

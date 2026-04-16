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

  it.each([
    {
      name: 'length',
      measure: length,
      geometry: 'LineString',
      measureValue: 'length',
      unitValues: ['m', 'ft', 'mi', 'nmi'],
    },
    {
      name: 'area',
      measure: area,
      geometry: 'Polygon',
      measureValue: 'area',
      unitValues: ['m2', 'km2', 'ft2', 'mi2', 'acre2', 'hectare2'],
    },
  ])(
    'should expose $name geometry, measure id, and documented units',
    ({ measure, geometry, measureValue, unitValues }) => {
      expect(measure.geometry).toBe(geometry);
      expect(measure.value).toBe(measureValue);
      expect(measure.units.map((u) => u.value)).toEqual(unitValues);
    }
  );

  it.each([
    { measureName: 'length', measure: length, code: 'ft' as const, expected: 'ft' as const },
    { measureName: 'length', measure: length, code: 'ft2' as const, expected: 'ft' as const },
    { measureName: 'area', measure: area, code: 'ft2' as const, expected: 'ft2' as const },
    { measureName: 'area', measure: area, code: 'ft' as const, expected: 'ft2' as const },
    { measureName: 'length', measure: length, code: 'does-not-exist' as const, expected: 'm' as const },
    { measureName: 'area', measure: area, code: 'does-not-exist' as const, expected: 'm2' as const },
  ])('getUnit on $measureName: $code → $expected', ({ measure, code, expected }) => {
    expect(measure.getUnit(code).value).toBe(expected);
  });
});

describe('map measure formatters (SI → displayed unit)', () => {
  const length = measures[0];
  const area = measures[1];

  it.each([
    {
      name: 'nautical miles (1852 m ≈ 1 nmi)',
      measure: length,
      unitValue: 'nmi',
      siMeters: 1852,
      expected: 1,
      digits: 2,
    },
    {
      name: 'statute miles (1609 m ≈ 1 mi)',
      measure: length,
      unitValue: 'mi',
      siMeters: 1609,
      expected: 1,
      digits: 2,
    },
    {
      name: 'feet (1 m ≈ 3.28 ft)',
      measure: length,
      unitValue: 'ft',
      siMeters: 1,
      expected: 3.28084,
      digits: 2,
    },
    {
      name: 'meters pass-through',
      measure: length,
      unitValue: 'm',
      siMeters: 42,
      expected: 42,
      digits: 5,
    },
    {
      name: 'm² pass-through',
      measure: area,
      unitValue: 'm2',
      siMeters: 123,
      expected: 123,
      digits: 3,
    },
    {
      name: 'km² (1e6 m² = 1 km²)',
      measure: area,
      unitValue: 'km2',
      siMeters: 1_000_000,
      expected: 1,
      digits: 5,
    },
    {
      name: 'hectares (10 000 m² = 1 ha)',
      measure: area,
      unitValue: 'hectare2',
      siMeters: 10_000,
      expected: 1,
      digits: 5,
    },
    {
      name: 'ft² from m² (scale factor; display rounds)',
      measure: area,
      unitValue: 'ft2',
      siMeters: 1,
      expected: 10.76391,
      digits: 0,
    },
    {
      name: 'mi² at scale where primary value is ~1 mi²',
      measure: area,
      unitValue: 'mi2',
      siMeters: 1 / 3.861e-7,
      expected: 1,
      digits: 0,
    },
    {
      name: 'acres (10 000 m² ≈ 2.47 ac)',
      measure: area,
      unitValue: 'acre2',
      siMeters: 10_000,
      expected: 2.47105,
      digits: 1,
    },
  ])('should format length/area: $name', ({ measure, unitValue, siMeters, expected, digits }) => {
    const unit = measure.units.find((u) => u.value === unitValue)!;
    expect(numericPart(unit.format(siMeters))).toBeCloseTo(expected, digits);
  });
});

import { measures } from './measure';

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

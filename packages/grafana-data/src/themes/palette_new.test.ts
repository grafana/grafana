import { palette, resolvePaletteRefs } from './palette_new';

describe('resolvePaletteRefs', () => {
  it('resolves a single palette reference in a string', () => {
    expect(resolvePaletteRefs('palette.blue500')).toBe(palette.blue500);
  });

  it('resolves a reference embedded in a larger string', () => {
    expect(resolvePaletteRefs('1px solid palette.neutral300')).toBe(`1px solid ${palette.neutral300}`);
  });

  it('resolves multiple references in the same string', () => {
    expect(resolvePaletteRefs('palette.white palette.black')).toBe(`${palette.white} ${palette.black}`);
  });

  it('leaves unknown palette keys untouched', () => {
    expect(resolvePaletteRefs('palette.doesNotExist')).toBe('palette.doesNotExist');
  });

  it('leaves strings without references untouched', () => {
    expect(resolvePaletteRefs('#ffffff')).toBe('#ffffff');
  });

  it('recurses into nested objects', () => {
    const input = {
      border: { weak: 'palette.neutral200', strong: 'palette.neutral400' },
      text: 'palette.ink900',
    };

    expect(resolvePaletteRefs(input)).toEqual({
      border: { weak: palette.neutral200, strong: palette.neutral400 },
      text: palette.ink900,
    });
  });

  it('recurses into arrays', () => {
    expect(resolvePaletteRefs(['palette.blue500', 'palette.coral500'])).toEqual([palette.blue500, palette.coral500]);
  });

  it('handles arrays nested inside objects', () => {
    const input = { categorical: ['palette.blue500', { shade: 'palette.violet300' }] };

    expect(resolvePaletteRefs(input)).toEqual({
      categorical: [palette.blue500, { shade: palette.violet300 }],
    });
  });

  it('preserves non-string primitive values', () => {
    const input = { count: 42, enabled: true, missing: null, color: 'palette.sage500' };

    expect(resolvePaletteRefs(input)).toEqual({
      count: 42,
      enabled: true,
      missing: null,
      color: palette.sage500,
    });
  });

  it('returns null and undefined unchanged', () => {
    expect(resolvePaletteRefs(null)).toBeNull();
    expect(resolvePaletteRefs(undefined)).toBeUndefined();
  });
});

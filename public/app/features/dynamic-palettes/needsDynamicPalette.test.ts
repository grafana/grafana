import { type FieldConfigSource } from '@grafana/data';

import { needsDynamicPalette } from './needsDynamicPalette';

function makeFieldConfig(overrides: Partial<FieldConfigSource> = {}): FieldConfigSource {
  return {
    defaults: {},
    overrides: [],
    ...overrides,
  };
}

describe('needsDynamicPalette', () => {
  it('returns false when fieldConfig is undefined', () => {
    expect(needsDynamicPalette(undefined)).toBe(false);
  });

  it('returns false when no color mode is set anywhere', () => {
    expect(needsDynamicPalette(makeFieldConfig())).toBe(false);
  });

  it('returns false for built-in default color modes', () => {
    expect(needsDynamicPalette(makeFieldConfig({ defaults: { color: { mode: 'thresholds' } } }))).toBe(false);
    expect(needsDynamicPalette(makeFieldConfig({ defaults: { color: { mode: 'palette-classic' } } }))).toBe(false);
  });

  it('returns true when defaults reference an unknown color mode', () => {
    expect(needsDynamicPalette(makeFieldConfig({ defaults: { color: { mode: `sunset-${Date.now()}` } } }))).toBe(true);
  });

  it('returns false when an override sets a built-in color mode', () => {
    const config = makeFieldConfig({
      overrides: [
        {
          matcher: { id: 'byName', options: 'metric' },
          properties: [{ id: 'color', value: { mode: 'palette-classic' } }],
        },
      ],
    });

    expect(needsDynamicPalette(config)).toBe(false);
  });

  it('returns true when an override references an unknown color mode', () => {
    const config = makeFieldConfig({
      overrides: [
        {
          matcher: { id: 'byName', options: 'metric' },
          properties: [{ id: 'color', value: { mode: `sunset-${Date.now()}` } }],
        },
      ],
    });

    expect(needsDynamicPalette(config)).toBe(true);
  });

  it('ignores non-color override properties', () => {
    const config = makeFieldConfig({
      overrides: [
        {
          matcher: { id: 'byName', options: 'metric' },
          properties: [
            { id: 'unit', value: 'short' },
            { id: 'displayName', value: `sunset-${Date.now()}` },
          ],
        },
      ],
    });

    expect(needsDynamicPalette(config)).toBe(false);
  });

  it('handles malformed override color values without throwing', () => {
    const config = makeFieldConfig({
      overrides: [
        {
          matcher: { id: 'byName', options: 'metric' },
          properties: [
            { id: 'color', value: undefined },
            { id: 'color', value: 'not-an-object' },
            { id: 'color', value: { mode: 42 } },
          ],
        },
      ],
    });

    expect(needsDynamicPalette(config)).toBe(false);
  });
});

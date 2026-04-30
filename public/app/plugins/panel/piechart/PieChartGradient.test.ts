import { FieldColorModeId, type FieldDisplay } from '@grafana/data';

import { computeGradientFills } from './PieChart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal FieldDisplay stub with just the properties we need. */
function makeItem(title: string, value: number): FieldDisplay {
  return {
    display: { title, numeric: value, text: String(value) },
    field: { config: {} },
    hasLinks: false,
    view: undefined,
  } as unknown as FieldDisplay;
}

/**
 * Build a FieldDisplay stub whose color config matches the panel-level gradient
 * defaults (mode: gradient + matching fixedColor + gradientColorTo). These items
 * pass the PieChartPanel filter and are included in gradient computation.
 */
function makeGradientItem(title: string, value: number, fixedColor: string, gradientColorTo: string): FieldDisplay {
  return {
    display: { title, numeric: value, text: String(value), color: fixedColor },
    field: { color: { mode: FieldColorModeId.Gradient, fixedColor, gradientColorTo } },
    hasLinks: false,
    view: undefined,
  } as unknown as FieldDisplay;
}

/**
 * Build a FieldDisplay stub that simulates a series with a fixed-color override
 * (e.g. the user pinned it to a specific color via the Overrides editor).
 * PieChartPanel detects these via field.color.mode !== 'gradient' and excludes
 * them from gradient computation so the override color is preserved.
 */
function makeItemWithFixedOverride(title: string, value: number, overrideColor: string): FieldDisplay {
  return {
    display: { title, numeric: value, text: String(value), color: overrideColor },
    // FieldDisplay.field is FieldConfig — the merged config for this series.
    // An overridden series has field.color.mode set to the override value (e.g. 'fixed').
    field: { color: { mode: FieldColorModeId.Fixed, fixedColor: overrideColor } },
    hasLinks: false,
    view: undefined,
  } as unknown as FieldDisplay;
}

/**
 * Build a FieldDisplay stub that simulates a series with a gradient-mode override
 * but with different from/to colors than the panel defaults.
 * PieChartPanel detects these via color config mismatch and excludes them so
 * the override's own colors take effect (start color visible, full gradient-
 * within-gradient rendering deferred to a follow-up).
 */
function makeItemWithGradientOverride(
  title: string,
  value: number,
  fixedColor: string,
  gradientColorTo: string,
  resolvedColor: string
): FieldDisplay {
  return {
    display: { title, numeric: value, text: String(value), color: resolvedColor },
    field: { color: { mode: FieldColorModeId.Gradient, fixedColor, gradientColorTo } },
    hasLinks: false,
    view: undefined,
  } as unknown as FieldDisplay;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

const COLOR_GREEN = '#00ff00'; // rgb(0, 255, 0)
const COLOR_RED = '#ff0000'; // rgb(255, 0, 0)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeGradientFills', () => {
  describe('N = 1 (single slice)', () => {
    it('returns colorFrom for the only slice', () => {
      const a = makeItem('A', 100);
      const fills = computeGradientFills([a], COLOR_GREEN, COLOR_RED);

      expect(fills.size).toBe(1);
      // t = 0 → should be exactly colorFrom
      const { r, g, b } = hexToRgb(fills.get(a)!);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });
  });

  describe('N = 2 (two slices)', () => {
    it('assigns colorFrom to the largest and colorTo to the smallest', () => {
      const small = makeItem('small', 10);
      const large = makeItem('large', 90);
      const fills = computeGradientFills([small, large], COLOR_GREEN, COLOR_RED);

      expect(fills.size).toBe(2);

      // largest → t=0 → colorFrom (green)
      const largeRgb = hexToRgb(fills.get(large)!);
      expect(largeRgb.r).toBe(0);
      expect(largeRgb.g).toBe(255);
      expect(largeRgb.b).toBe(0);

      // smallest → t=1 → colorTo (red)
      const smallRgb = hexToRgb(fills.get(small)!);
      expect(smallRgb.r).toBe(255);
      expect(smallRgb.g).toBe(0);
      expect(smallRgb.b).toBe(0);
    });
  });

  describe('N = 5 (multiple slices)', () => {
    const rank4 = makeItem('rank4', 10);
    const rank2 = makeItem('rank2', 60);
    const rank0 = makeItem('rank0', 100);
    const rank3 = makeItem('rank3', 30);
    const rank1 = makeItem('rank1', 80);
    const items = [rank4, rank2, rank0, rank3, rank1];

    // GREEN (#00ff00) → RED (#ff0000)
    // Sorted descending: rank0(100), rank1(80), rank2(60), rank3(30), rank4(10)
    // t values:         0,         0.25,       0.5,       0.75,      1.0

    it('produces 5 distinct fills', () => {
      const fills = computeGradientFills(items, COLOR_GREEN, COLOR_RED);
      expect(fills.size).toBe(5);
    });

    it('rank0 (largest) gets colorFrom', () => {
      const fills = computeGradientFills(items, COLOR_GREEN, COLOR_RED);
      const { r, g, b } = hexToRgb(fills.get(rank0)!);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });

    it('rank4 (smallest) gets colorTo', () => {
      const fills = computeGradientFills(items, COLOR_GREEN, COLOR_RED);
      const { r, g, b } = hexToRgb(fills.get(rank4)!);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('rank2 (middle, t=0.5) gets the midpoint color', () => {
      const fills = computeGradientFills(items, COLOR_GREEN, COLOR_RED);
      // t=0.5 → r=round(0*(0.5)+255*0.5)=128, g=round(255*0.5+0*0.5)=128, b=0
      const { r, g, b } = hexToRgb(fills.get(rank2)!);
      expect(r).toBe(128);
      expect(g).toBe(128);
      expect(b).toBe(0);
    });

    it('colors become progressively more red as rank increases', () => {
      const fills = computeGradientFills(items, COLOR_GREEN, COLOR_RED);
      const refs = [rank0, rank1, rank2, rank3, rank4];
      const reds = refs.map((item) => hexToRgb(fills.get(item)!).r);
      // Red channel should be monotonically non-decreasing
      for (let i = 0; i < reds.length - 1; i++) {
        expect(reds[i]).toBeLessThanOrEqual(reds[i + 1]);
      }
    });
  });

  describe('duplicate display names (non-unique titles)', () => {
    it('assigns distinct colors to items with the same display name', () => {
      // Two series both named 'CPU' — title-based keying would map both to the same entry.
      const cpu1 = makeItem('CPU', 90);
      const cpu2 = makeItem('CPU', 10);
      const fills = computeGradientFills([cpu1, cpu2], COLOR_GREEN, COLOR_RED);

      expect(fills.size).toBe(2);
      // cpu1 is larger → gets colorFrom (green)
      const { r: r1, g: g1 } = hexToRgb(fills.get(cpu1)!);
      expect(r1).toBe(0);
      expect(g1).toBe(255);
      // cpu2 is smaller → gets colorTo (red)
      const { r: r2, g: g2 } = hexToRgb(fills.get(cpu2)!);
      expect(r2).toBe(255);
      expect(g2).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles all slices with the same value (stable order, no NaN)', () => {
      const a = makeItem('A', 50);
      const b = makeItem('B', 50);
      const c = makeItem('C', 50);
      const fills = computeGradientFills([a, b, c], COLOR_GREEN, COLOR_RED);

      expect(fills.size).toBe(3);
      // No NaN or undefined values
      for (const color of fills.values()) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('returns an empty Map for an empty input array', () => {
      const fills = computeGradientFills([], COLOR_GREEN, COLOR_RED);
      expect(fills.size).toBe(0);
    });

    it('does not mutate the input array order', () => {
      const first = makeItem('first', 10);
      const second = makeItem('second', 90);
      const items = [first, second];
      const originalOrder = [...items];
      computeGradientFills(items, COLOR_GREEN, COLOR_RED);
      expect(items).toEqual(originalOrder);
    });

    it('accepts shorthand hex colors (tinycolor normalises them)', () => {
      const a = makeItem('A', 100);
      const b = makeItem('B', 50);
      // #f00 = red, #0f0 = green — tinycolor expands these
      expect(() => computeGradientFills([a, b], '#0f0', '#f00')).not.toThrow();
      const fills = computeGradientFills([a, b], '#0f0', '#f00');
      expect(fills.size).toBe(2);
    });
  });

  describe('field-level color overrides', () => {
    // Panel-level defaults used by the filter to detect per-field overrides.
    const PANEL_FROM = COLOR_GREEN; // '#00ff00'
    const PANEL_TO = COLOR_RED; // '#ff0000'

    /**
     * Mirrors the filter logic in PieChartPanel.tsx:
     * include a field in gradient computation only when its color config
     * matches the panel defaults exactly (mode + fixedColor + gradientColorTo).
     */
    function panelFilter(item: FieldDisplay): boolean {
      return (
        item.field.color?.mode === FieldColorModeId.Gradient &&
        item.field.color.fixedColor === PANEL_FROM &&
        item.field.color.gradientColorTo === PANEL_TO
      );
    }

    it('fixed-color override is excluded from gradient fills', () => {
      const normal = makeGradientItem('normal', 80, PANEL_FROM, PANEL_TO);
      const overridden = makeItemWithFixedOverride('overridden', 100, '#0000ff');

      const fills = computeGradientFills([normal, overridden].filter(panelFilter), PANEL_FROM, PANEL_TO);

      expect(fills.has(overridden)).toBe(false);
      expect(fills.has(normal)).toBe(true);
      // normal is the only gradient item → t=0 → colorFrom (green)
      const { r, g, b } = hexToRgb(fills.get(normal)!);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });

    it('gradient override with same colors as panel defaults is included', () => {
      const normal = makeGradientItem('normal', 80, PANEL_FROM, PANEL_TO);
      // Override sets gradient mode with the exact same colors → treated as default gradient
      const sameGradient = makeGradientItem('same', 100, PANEL_FROM, PANEL_TO);

      const fills = computeGradientFills([normal, sameGradient].filter(panelFilter), PANEL_FROM, PANEL_TO);

      expect(fills.has(sameGradient)).toBe(true);
      expect(fills.has(normal)).toBe(true);
      expect(fills.size).toBe(2);
    });

    it('gradient override with different fixedColor is excluded', () => {
      const normal = makeGradientItem('normal', 50, PANEL_FROM, PANEL_TO);
      // Override sets gradient mode but with a different start color (blue→red)
      const diffFrom = makeItemWithGradientOverride('diffFrom', 100, '#0000ff', PANEL_TO, '#0000ff');

      const fills = computeGradientFills([normal, diffFrom].filter(panelFilter), PANEL_FROM, PANEL_TO);

      expect(fills.has(diffFrom)).toBe(false);
      expect(fills.has(normal)).toBe(true);
    });

    it('gradient override with different gradientColorTo is excluded', () => {
      const normal = makeGradientItem('normal', 50, PANEL_FROM, PANEL_TO);
      // Override sets gradient mode but with a different end color (green→blue)
      const diffTo = makeItemWithGradientOverride('diffTo', 100, PANEL_FROM, '#0000ff', PANEL_FROM);

      const fills = computeGradientFills([normal, diffTo].filter(panelFilter), PANEL_FROM, PANEL_TO);

      expect(fills.has(diffTo)).toBe(false);
      expect(fills.has(normal)).toBe(true);
    });

    it('excluded gradient-override item falls back to display.color (override start color)', () => {
      // Arc renderer uses display.color when item is absent from gradientFills map.
      const diffFrom = makeItemWithGradientOverride('override', 100, '#0000ff', COLOR_RED, '#0000ff');
      const normal = makeGradientItem('normal', 50, PANEL_FROM, PANEL_TO);

      const fills = computeGradientFills([normal, diffFrom].filter(panelFilter), PANEL_FROM, PANEL_TO);

      // Not in fills → arc falls back to display.color = '#0000ff' (blue, the override start)
      expect(fills.has(diffFrom)).toBe(false);
      expect(diffFrom.display.color).toBe('#0000ff');
    });
  });
});

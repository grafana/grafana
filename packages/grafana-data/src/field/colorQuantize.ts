/**
 * Number of discrete steps a continuous color scheme is sampled into when
 * precomputing a palette. 128 keeps the snapping between steps imperceptible
 * and matches the heatmap panel's internal default.
 *
 * @beta
 */
export const CONTINUOUS_PALETTE_STEPS = 128;

/**
 * Sample a continuous color interpolator into a fixed-size palette of discrete
 * colors. Precomputing the palette lets by-value color lookups be O(1) index
 * math instead of an interpolator call per value.
 *
 * The returned colors are whatever the interpolator produces (d3 interpolators
 * yield `rgb(...)` strings); no normalization is applied.
 *
 * @beta
 */
export function quantizeInterpolator(interpolate: (t: number) => string, steps = CONTINUOUS_PALETTE_STEPS): string[] {
  const last = steps - 1;
  const palette = new Array<string>(steps);

  for (let i = 0; i < steps; i++) {
    palette[i] = interpolate(i / last);
  }

  return palette;
}

/**
 * Map a 0..1 percent to a color in a precomputed palette, clamping to the
 * palette bounds. The index contract (`floor(percent * length)`) matches the
 * heatmap panel's `valuesToFills` so both paths agree.
 *
 * @beta
 */
export function paletteColorAt(palette: string[], percent: number): string {
  const idx = Math.min(palette.length - 1, Math.max(0, Math.floor(percent * palette.length)));
  return palette[idx];
}

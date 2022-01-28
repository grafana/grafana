import { GrafanaTheme2 } from '@grafana/data';
import * as d3ScaleChromatic from 'd3-scale-chromatic';

// https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic

// the previous heatmap panel used d3 deps and some code to interpolate to static 9-color palettes. here we just hard-code them for clarity.
// if the need arises for configurable-sized palettes, we can bring back the deps & variable interpolation (see simplified code at end)

// Schemes from d3-scale-chromatic
// https://github.com/d3/d3-scale-chromatic
export const colorSchemes = [
  // Diverging
  { name: 'BrBG', invert: 'always' },
  { name: 'PiYG', invert: 'always' },
  { name: 'PRGn', invert: 'always' },
  { name: 'PuOr', invert: 'always' },
  { name: 'RdBu', invert: 'always' },
  { name: 'RdGy', invert: 'always' },
  { name: 'RdYlBu', invert: 'always' },
  { name: 'RdYlGn', invert: 'always' },
  { name: 'Spectral', invert: 'always' },

  // Sequential (Single Hue)
  { name: 'Blues', invert: 'dark' },
  { name: 'Greens', invert: 'dark' },
  { name: 'Greys', invert: 'dark' },
  { name: 'Oranges', invert: 'dark' },
  { name: 'Purples', invert: 'dark' },
  { name: 'Reds', invert: 'dark' },

  // Sequential (Multi-Hue)
  { name: 'Turbo', invert: 'light' },
  { name: 'Cividis', invert: 'light' },
  { name: 'Viridis', invert: 'light' },
  { name: 'Magma', invert: 'light' },
  { name: 'Inferno', invert: 'light' },
  { name: 'Plasma', invert: 'light' },
  { name: 'Warm', invert: 'light' },
  { name: 'Cool', invert: 'light' },
  { name: 'Cubehelix', invert: 'light', name2: 'CubehelixDefault' },
  { name: 'BuGn', invert: 'dark' },
  { name: 'BuPu', invert: 'dark' },
  { name: 'GnBu', invert: 'dark' },
  { name: 'OrRd', invert: 'dark' },
  { name: 'PuBuGn', invert: 'dark' },
  { name: 'PuBu', invert: 'dark' },
  { name: 'PuRd', invert: 'dark' },
  { name: 'RdPu', invert: 'dark' },
  { name: 'YlGnBu', invert: 'dark' },
  { name: 'YlGn', invert: 'dark' },
  { name: 'YlOrBr', invert: 'dark' },
  { name: 'YlOrRd', invert: 'dark' },

  // Cyclical
  { name: 'Rainbow', invert: 'always' },
  { name: 'Sinebow', invert: 'always' },
];

type Interpolator = (t: number) => string;

const DEFAULT_SCHEME = colorSchemes.find((scheme) => scheme.name === 'Spectral');

export function quantizeScheme(schemeName: string, steps: number, theme: GrafanaTheme2) {
  let scheme = colorSchemes.find((scheme) => scheme.name === schemeName) ?? DEFAULT_SCHEME!;
  let fnName = 'interpolate' + (scheme.name2 ?? scheme.name);
  const interpolate: Interpolator = d3ScaleChromatic[fnName];

  let palette = [];

  steps--;

  for (let i = 0; i <= steps; i++) {
    let rgbStr = interpolate(i / steps);
    let rgb =
      rgbStr.indexOf('rgb') === 0
        ? '#' + [...rgbStr.matchAll(/\d+/g)].map((v) => (+v[0]).toString(16).padStart(2, '0')).join('')
        : rgbStr;
    palette.push(rgb);
  }

  if (
    scheme.invert === 'always' ||
    (scheme.invert === 'dark' && theme.isDark) ||
    (scheme.invert === 'light' && theme.isLight)
  ) {
    palette.reverse();
  }

  return palette;
}

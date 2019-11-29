export interface Threshold {
  value: number;
  color: string;
  state?: string; // Warning, Error, LowLow, Low, OK, High, HighHigh etc
}

export enum ScaleMode {
  absolute = 'absolute',
  relative = 'relative', // between 0 and 1 (based on min/max)
  schema = 'schema', // Pick from D3 scheme
}

export interface Scale {
  mode: ScaleMode;
  scheme?: ColorScheme; // D3 schema lookup
  discrete?: number; // When using scheme -- this makes it discrete steps

  // Must be sorted by 'value', first value is always -Infinity
  steps: Threshold[];
}

// https://github.com/d3/d3-scale-chromatic
export enum ColorScheme {
  BrBG = 'BrBG',
  PRGn = 'PRGn',
  PiYG = 'PiYG',
  PuOr = 'PuOr',
  RdBu = 'RdBu',
  RdGy = 'RdGy',
  RdYlBu = 'RdYlBu',
  RdYlGn = 'RdYlGn',
  Spectral = 'Spectral',
  BuGn = 'BuGn',
  BuPu = 'BuPu',
  GnBu = 'GnBu',
  OrRd = 'OrRd',
  PuBuGn = 'PuBuGn',
  PuBu = 'PuBu',
  PuRd = 'PuRd',
  RdPu = 'RdPu',
  YlGnBu = 'YlGnBu',
  YlGn = 'YlGn',
  YlOrBr = 'YlOrBr',
  YlOrRd = 'YlOrRd',
  Blues = 'Blues',
  Greens = 'Greens',
  Greys = 'Greys',
  Purples = 'Purples',
  Reds = 'Reds',
  Oranges = 'Oranges',

  // interpolateCubehelix
  // interpolateRainbow,
  // interpolateWarm
  // interpolateCool
  // interpolateSinebow
  // interpolateViridis
  // interpolateMagma
  // interpolateInferno
  // interpolatePlasma
}

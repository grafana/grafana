export enum FieldColorMode {
  Thresholds = 'thresholds',
  Scheme = 'scheme',
  Fixed = 'fixed',
}

export interface FieldColor {
  mode: FieldColorMode;
  schemeName?: ColorScheme;
  fixedColor?: string;
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

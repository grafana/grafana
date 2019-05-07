export interface Threshold {
  value: number;
  color: string;
  state?: string; // Warning, Error, LowLow, Low, OK, High, HighHigh etc
}

// https://github.com/d3/d3-scale-chromatic
export enum ColorScheme {
  // Sequential (Single-Hue)
  Blues = 'Blues',
  Greens = 'Greens',
  Greys = 'Greys',
  Oranges = 'Oranges',
  Purples = 'Purples',
  Reds = 'Reds',

  // Sequential (Multi-Hue)
  BuGn = 'BuGn',
  BuPu = 'BuPu',
  GnBu = 'GnBu',

  // TODO... the rest
}

export interface Scale {
  scheme?: ColorScheme;
  discrete?: number; // convert a scheme into discrete steps
  thresholds?: Threshold[]; // will be ordered by value
}

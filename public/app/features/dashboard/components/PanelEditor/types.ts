// Us
export enum DisplayMode {
  Full = 0,
  Fit = 1,
  Exact = 2,
}

export const displayModes = [
  { value: DisplayMode.Full, label: 'Full', description: 'Use all avaliable space' },
  { value: DisplayMode.Fit, label: 'Fit', description: 'Fit in the space keeping ratio' },
  { value: DisplayMode.Exact, label: 'Exact', description: 'Same size as the dashboard' },
];

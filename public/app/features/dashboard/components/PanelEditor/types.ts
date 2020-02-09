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

export enum EditorTab {
  Query = 'query',
  Alerts = 'alerts',
  Transform = 'xform',
}

export const allTabs = [
  { tab: EditorTab.Query, label: 'Query', show: (panel: PanelModel) => true },
  { tab: EditorTab.Alerts, label: 'Alerts', show: (panel: PanelModel) => true },
  { tab: EditorTab.Transform, label: 'Transform', show: (panel: PanelModel) => true },
];

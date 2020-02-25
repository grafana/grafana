export interface PanelEditorTab {
  id: string;
  text: string;
  active: boolean;
}

export enum PanelEditorTabId {
  Queries = 'queries',
  Transform = 'transform',
  Visualization = 'visualization',
  Alert = 'alert',
}

export enum DisplayMode {
  Fill = 0,
  Fit = 1,
  Exact = 2,
  Inspect = 3,
  JSON = 4,
}

export const displayModes = [
  { value: DisplayMode.Fill, label: 'Fill', description: 'Use all avaliable space' },
  { value: DisplayMode.Fit, label: 'Fit', description: 'Fit in the space keeping ratio' },
  { value: DisplayMode.Exact, label: 'Exact', description: 'Same size as the dashboard' },
  { value: DisplayMode.Inspect, label: 'Inspect', description: 'Show the panel inspector content' },
  { value: DisplayMode.JSON, label: 'JSON', description: 'Show the JSON model' },
];

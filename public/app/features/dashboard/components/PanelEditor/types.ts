import { DataFrame, FieldConfigSource, PanelData, PanelPlugin } from '@grafana/data';

import { DashboardModel, PanelModel } from '../../state';

export interface PanelEditorTab {
  id: string;
  text: string;
  active: boolean;
  icon: string;
}

export enum PanelEditorTabId {
  Query = 'query',
  Transform = 'transform',
  Visualize = 'visualize',
  Alert = 'alert',
}

export enum DisplayMode {
  Fill = 0,
  Fit = 1,
  Exact = 2,
}

export enum PanelEditTableToggle {
  Off = 0,
  Table = 1,
}

export const displayModes = [
  { value: DisplayMode.Fill, label: 'Fill', description: 'Use all available space' },
  { value: DisplayMode.Exact, label: 'Actual', description: 'Make same size as on the dashboard' },
];

export const panelEditTableModes = [
  {
    value: PanelEditTableToggle.Off,
    label: 'Visualization',
    description: 'Show using selected visualization',
  },
  { value: PanelEditTableToggle.Table, label: 'Table', description: 'Show raw data in table form' },
];

/** @internal */
export interface Props {
  plugin: PanelPlugin;
  config: FieldConfigSource;
  onChange: (config: FieldConfigSource) => void;
  /* Helpful for IntelliSense */
  data: DataFrame[];
}

export interface OptionPaneRenderProps {
  panel: PanelModel;
  plugin: PanelPlugin;
  data?: PanelData;
  dashboard: DashboardModel;
  instanceState: any;
  onPanelConfigChange: (configKey: keyof PanelModel, value: unknown) => void;
  onPanelOptionsChanged: (options: PanelModel['options']) => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
}

export interface OptionPaneItemOverrideInfo {
  type: 'data' | 'rule';
  onClick?: () => void;
  tooltip: string;
  description: string;
}

export enum VisualizationSelectPaneTab {
  Visualizations,
  LibraryPanels,
  Suggestions,
}

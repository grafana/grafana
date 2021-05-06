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

export const displayModes = [
  { value: DisplayMode.Fill, label: 'Fill', description: 'Use all available space' },
  { value: DisplayMode.Fit, label: 'Fit', description: 'Fit in the space keeping ratio' },
  { value: DisplayMode.Exact, label: 'Exact', description: 'Make same size as the dashboard' },
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
  onPanelConfigChange: (configKey: string, value: any) => void;
  onPanelOptionsChanged: (options: any) => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
}

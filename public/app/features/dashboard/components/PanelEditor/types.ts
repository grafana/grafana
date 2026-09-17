import { type FieldConfigSource, type PanelData, type PanelPlugin } from '@grafana/data';

import { type DashboardModel } from '../../state/DashboardModel';
import { type PanelModel } from '../../state/PanelModel';

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

export interface OptionPaneRenderProps {
  panel: PanelModel;
  plugin: PanelPlugin;
  data?: PanelData;
  dashboard: DashboardModel;
  instanceState: unknown;
  onPanelConfigChange: <T extends keyof PanelModel>(configKey: T, value: PanelModel[T]) => void;
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

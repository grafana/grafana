import { VizPanelPlugin } from '@grafana/ui';
import { PieChartPanelEditor } from './PieChartPanelEditor';
import { PieChartPanel } from './PieChartPanel';
import { PieChartOptions, defaults } from './types';

export const plugin = new VizPanelPlugin<PieChartOptions>(PieChartPanel)
  .setDefaults(defaults)
  .setEditor(PieChartPanelEditor);

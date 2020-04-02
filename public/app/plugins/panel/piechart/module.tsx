import { PanelPlugin, FieldConfigProperty } from '@grafana/data';
import { PieChartPanelEditor } from './PieChartPanelEditor';
import { PieChartPanel } from './PieChartPanel';
import { PieChartOptions, defaults } from './types';

export const plugin = new PanelPlugin<PieChartOptions>(PieChartPanel)
  .setDefaults(defaults)
  .useStandardFieldConfig(null, {
    [FieldConfigProperty.Unit]: 'short',
  })
  .setEditor(PieChartPanelEditor);

import { PanelOptionsEditorBuilder } from '@grafana/data';
import { ScaleDistribution } from '@grafana/schema';
import { ScaleDistributionEditor } from '@grafana/ui/src/options/builder';

import { HeatmapCalculationMode, HeatmapCalculationOptions } from '../models.gen';

import { AxisEditor } from './AxisEditor';

export function addHeatmapCalculationOptions(
  prefix: string,
  builder: PanelOptionsEditorBuilder<any>,
  source?: HeatmapCalculationOptions,
  category?: string[]
) {
  builder.addCustomEditor({
    id: 'xAxis',
    path: `${prefix}xAxis`,
    name: 'X Axis',
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
  });

  builder.addCustomEditor({
    id: 'yAxis-scale',
    path: `${prefix}yAxis.scale`,
    name: 'Y Axis',
    category,
    editor: ScaleDistributionEditor,
    defaultValue: { type: ScaleDistribution.Linear },
  });

  builder.addCustomEditor({
    id: 'yAxis',
    path: `${prefix}yAxis`,
    name: '',
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
  });
}

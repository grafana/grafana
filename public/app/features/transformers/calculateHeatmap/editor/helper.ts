import { PanelOptionsEditorBuilder } from '@grafana/data';

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
    name: 'X Buckets',
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
  });

  builder.addCustomEditor({
    id: 'yAxis',
    path: `${prefix}yAxis`,
    name: 'Y Buckets',
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
  });
}

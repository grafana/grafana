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
    id: 'xBuckets',
    path: `${prefix}xBuckets`,
    name: 'X Buckets',
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
  });

  builder.addCustomEditor({
    id: 'yBuckets-scale',
    path: `${prefix}yBuckets.scale`,
    name: 'Y Buckets',
    category,
    editor: ScaleDistributionEditor,
    defaultValue: { type: ScaleDistribution.Linear },
  });

  builder.addCustomEditor({
    id: 'yBuckets',
    path: `${prefix}yBuckets`,
    name: '',
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
  });
}

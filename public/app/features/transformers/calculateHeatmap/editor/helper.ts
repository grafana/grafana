import { PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScaleDistribution, HeatmapCalculationMode, HeatmapCalculationOptions } from '@grafana/schema';
import { ScaleDistributionEditor } from '@grafana/ui/internal';

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
    name: t('transformers.calculate-heatmap.add-heatmap-calculation-options.name-x-bucket', 'X Bucket'),
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
    settings: {
      allowInterval: true,
    },
  });

  builder.addCustomEditor({
    id: 'yBuckets',
    path: `${prefix}yBuckets`,
    name: t('transformers.calculate-heatmap.add-heatmap-calculation-options.name-y-bucket', 'Y Bucket'),
    editor: AxisEditor,
    category,
    defaultValue: {
      mode: HeatmapCalculationMode.Size,
    },
  });

  builder.addCustomEditor({
    id: 'yBuckets-scale',
    path: `${prefix}yBuckets.scale`,
    name: t('transformers.calculate-heatmap.add-heatmap-calculation-options.name-y-bucket-scale', 'Y Bucket scale'),
    category,
    editor: ScaleDistributionEditor,
    defaultValue: { type: ScaleDistribution.Linear },
  });
}

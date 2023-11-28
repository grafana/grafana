import { ScaleDistribution, HeatmapCalculationMode } from '@grafana/schema';
import { ScaleDistributionEditor } from '@grafana/ui/src/options/builder';
import { AxisEditor } from './AxisEditor';
export function addHeatmapCalculationOptions(prefix, builder, source, category) {
    builder.addCustomEditor({
        id: 'xBuckets',
        path: `${prefix}xBuckets`,
        name: 'X Bucket',
        editor: AxisEditor,
        category,
        defaultValue: {
            mode: HeatmapCalculationMode.Size,
        },
    });
    builder.addCustomEditor({
        id: 'yBuckets',
        path: `${prefix}yBuckets`,
        name: 'Y Bucket',
        editor: AxisEditor,
        category,
        defaultValue: {
            mode: HeatmapCalculationMode.Size,
        },
    });
    builder.addCustomEditor({
        id: 'yBuckets-scale',
        path: `${prefix}yBuckets.scale`,
        name: 'Y Bucket scale',
        category,
        editor: ScaleDistributionEditor,
        defaultValue: { type: ScaleDistribution.Linear },
    });
}
//# sourceMappingURL=helper.js.map
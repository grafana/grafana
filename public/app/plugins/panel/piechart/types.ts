import { PieChartType, StatID, VizOrientation, SingleStatBaseOptions } from '@grafana/ui';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  strokeWidth: number;
}

export const defaults: PieChartOptions = {
  pieType: PieChartType.PIE,
  strokeWidth: 1,
  orientation: VizOrientation.Auto,
  fieldOptions: {
    title: '', // auto title
    values: false,
    stats: [StatID.last],
    defaults: {},
    override: {
      unit: 'short',
    },
    mappings: [],
    thresholds: [],
  },
};

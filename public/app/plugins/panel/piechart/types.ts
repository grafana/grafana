import { PieChartType, StatID, VizOrientation, SingleStatBaseOptions } from '@grafana/ui';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  strokeWidth: number;
}

export const defaults: PieChartOptions = {
  pieType: PieChartType.PIE,
  strokeWidth: 1,
  valueOptions: {
    title: '', // auto title
    showAllValues: false,
    stats: [StatID.last],
    defaults: {},
    override: {
      unit: 'short',
    },
  },
  valueMappings: [],
  thresholds: [],
  orientation: VizOrientation.Auto,
};

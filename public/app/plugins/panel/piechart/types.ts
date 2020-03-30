import { PieChartType, SingleStatBaseOptions } from '@grafana/ui';
import { commonValueOptionDefaults } from '../stat/types';
import { VizOrientation } from '@grafana/data';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  strokeWidth: number;
}

export const defaults: PieChartOptions = {
  pieType: PieChartType.PIE,
  strokeWidth: 1,
  orientation: VizOrientation.Auto,
  reduceOptions: commonValueOptionDefaults,
};

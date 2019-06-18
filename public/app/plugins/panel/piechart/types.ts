import { PieChartType, ReducerID, VizOrientation, SingleStatBaseOptions } from '@grafana/ui';
import { standardFieldDisplayOptions } from '../singlestat2/types';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  strokeWidth: number;
}

export const defaults: PieChartOptions = {
  pieType: PieChartType.PIE,
  strokeWidth: 1,
  orientation: VizOrientation.Auto,
  fieldOptions: {
    ...standardFieldDisplayOptions,
    calcs: [ReducerID.last],
    defaults: {
      unit: 'short',
    },
  },
};

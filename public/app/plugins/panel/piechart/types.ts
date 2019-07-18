import { PieChartType, VizOrientation, SingleStatBaseOptions } from '@grafana/ui';
import { standardFieldDisplayOptions } from '../singlestat2/types';
import { ReducerID } from '@grafana/data';

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

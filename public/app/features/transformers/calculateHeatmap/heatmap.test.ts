import { FieldType } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe/processDataFrame';

import { calculateHeatmapFromData } from './heatmap';
import { HeatmapCalculationOptions } from './models.gen';

describe('Heatmap transformer', () => {
  it('calculate heatmap from input data', async () => {
    const options: HeatmapCalculationOptions = {
      //
    };

    const data = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
        { name: 'temp', type: FieldType.number, values: [1.1, 2.2, 3.3, 4.4] },
      ],
    });

    const heatmap = calculateHeatmapFromData([data], options);

    expect(heatmap).toBeDefined();
  });
});

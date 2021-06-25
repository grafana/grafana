import { DataFrame, FieldConfig, FieldSparkline, IndexVector } from '@grafana/data';
import { GraphFieldConfig } from '../uPlot/config';

/** @internal
 * Given a sparkline config returns a DataFrame ready to be turned into Plot data set
 **/
export function preparePlotFrame(sparkline: FieldSparkline, config?: FieldConfig<GraphFieldConfig>): DataFrame {
  const length = sparkline.y.values.length;
  const yFieldConfig = {
    ...sparkline.y.config,
    ...config,
  };

  return {
    refId: 'sparkline',
    fields: [
      sparkline.x ?? IndexVector.newField(length),
      {
        ...sparkline.y,
        config: yFieldConfig,
      },
    ],
    length,
  };
}

import { DataFrame, FieldConfig, FieldSparkline, FieldType, sortDataFrame } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';

import { applyNullInsertThreshold } from '../GraphNG/nullInsertThreshold';

/** @internal
 * Given a sparkline config returns a DataFrame ready to be turned into Plot data set
 **/
export function preparePlotFrame(sparkline: FieldSparkline, config?: FieldConfig<GraphFieldConfig>): DataFrame {
  const length = sparkline.y.values.length;
  const yFieldConfig = {
    ...sparkline.y.config,
    ...config,
  };

  const frame = {
    refId: 'sparkline',
    fields: [
      sparkline.x ?? {
        name: '',
        values: [...Array(length).keys()],
        type: FieldType.number,
        config: {},
      },
      {
        ...sparkline.y,
        config: yFieldConfig,
      },
    ],
    length,
  };

  const sortedFrame = sortDataFrame(frame, 0);

  return applyNullInsertThreshold({ frame: sortedFrame });
}

import {
  DataFrame,
  FieldConfig,
  FieldSparkline,
  FieldType,
  isLikelyAscendingVector,
  sortDataFrame,
} from '@grafana/data';
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

  const xField = sparkline.x ?? {
    name: '',
    values: [...Array(length).keys()],
    type: FieldType.number,
    config: {},
  };

  let frame: DataFrame = {
    refId: 'sparkline',
    fields: [
      xField,
      {
        ...sparkline.y,
        config: yFieldConfig,
      },
    ],
    length,
  };

  if (!isLikelyAscendingVector(xField.values)) {
    frame = sortDataFrame(frame, 0);
  }

  return applyNullInsertThreshold({
    frame,
    refFieldPseudoMin: sparkline.timeRange?.from.valueOf(),
    refFieldPseudoMax: sparkline.timeRange?.to.valueOf(),
  });
}

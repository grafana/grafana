import { Range } from 'uplot';

import {
  DataFrame,
  FieldConfig,
  FieldSparkline,
  FieldType,
  isLikelyAscendingVector,
  sortDataFrame,
  applyNullInsertThreshold,
  Field,
} from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';

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

/**
 * apply configuration defaults and ensure that the range is never two equal values.
 */
export function getYRange(field: Field, alignedFrame: DataFrame): Range.MinMax {
  let { min, max } = alignedFrame.fields[1].state?.range!;

  // enure that the min/max from the field config are respected
  min = Math.max(min!, field.config.min ?? -Infinity);
  max = Math.min(max!, field.config.max ?? Infinity);

  // if noValue is set, ensure that it is included in the range as well
  const noValue = +alignedFrame.fields[1].config?.noValue!;
  if (!Number.isNaN(noValue)) {
    min = Math.min(min, noValue);
    max = Math.max(max, noValue);
  }

  // if min and max are equal after all of that, create a range
  // that allows the sparkline to be visible in the center of the viz
  if (min === max) {
    if (min === 0) {
      max = 100;
    } else if (min < 0) {
      max = 0;
      min *= 2;
    } else {
      min = 0;
      max *= 2;
    }
  }

  return [min, max];
}

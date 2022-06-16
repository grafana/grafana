import { ConditionInfo, QueryConditionID, QueryConditionType, rangeUtil } from '@grafana/data';

import {
  OPERATORS,
  OPERATOR_ID,
  TimeRangeIntervalConditionEditor,
  TimeRangeIntervalConditionOptions,
} from './TimeRangeIntervalConditionEditor';

export const timeRangeIntervalCondition: ConditionInfo<TimeRangeIntervalConditionOptions> = {
  id: QueryConditionID.TimeRangeInterval,
  type: QueryConditionType.TimeRange,
  name: 'Time range interval',
  description: 'When the current time range is compared to provided interval',
  defaultOptions: {
    operator: OPERATOR_ID.LessThan,
    interval: '1m',
  },
  execute: (o, context) => {
    const currentTimeRangeInMs = context.timeRange.to.diff(context.timeRange.from);
    const interval = rangeUtil.intervalToMs(o.interval);
    const evaluate = OPERATORS.find((op) => op.id === o.operator)?.evaluate;
    if (!evaluate) {
      return false;
    }
    return evaluate(currentTimeRangeInMs, interval);
  },
  editor: TimeRangeIntervalConditionEditor,
  getVariableName: (options: any) => '',
};

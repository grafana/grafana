import { quickOptions } from '@grafana/ui/src/components/DateTimePickers/options';

import { QueryConditionID, QueryConditionInfo, QueryConditionType } from '../types';

import { TimeRangeConditionEditor, TimeRangeConditionOptions } from './TimeRangeConditionEditor';

export const timeRangeCondition: QueryConditionInfo<TimeRangeConditionOptions> = {
  id: QueryConditionID.TimeRange,
  type: QueryConditionType.TimeRange,
  name: 'Time range',
  description: 'When a time range is selected',
  defaultOptions: {
    value: {
      from: quickOptions[0].from,
      to: quickOptions[0].to,
    },
  },
  shouldExecute: (o, context) => {
    if (o.value.from === context.timeRange.raw.from && o.value.to === context.timeRange.raw.to) {
      return true;
    }
    return false;
  },
  editor: TimeRangeConditionEditor,
  getVariableName: () => '',
};

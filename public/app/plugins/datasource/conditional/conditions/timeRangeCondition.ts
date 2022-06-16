import { QueryConditionInfo, QueryConditionID, QueryConditionType } from '@grafana/data';
import { quickOptions } from '@grafana/ui/src/components/DateTimePickers/options';

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
  execute: (o, context) => {
    if (o.value.from === context.timeRange.raw.from && o.value.to === context.timeRange.raw.to) {
      return true;
    }
    return false;
  },
  editor: TimeRangeConditionEditor,
  getVariableName: (options: any) => '',
};

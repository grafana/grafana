import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Multiple, DateInterval } from '../abstract';

export const Intervals = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Intervals);
  return (
    <Multiple
      {...scopedProps('intervals')}
      label="Intervals"
      description="This defines the time ranges to run the query over"
      component={DateInterval}
      componentExtraProps={{
        label: 'Interval',
        description:
          'An interval. Can use variables (e.g: ${__from:date:iso} and ${__to:date:iso}) and ISO8601 durations (e.g: P1D).',
        time: true,
        format: 'MMMM d, yyyy h:mm aa',
      }}
    />
  );
};
Intervals.type = 'intervals';
Intervals.fields = ['intervals'];

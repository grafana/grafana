import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, DateTime, Row } from '../abstract';

export const Period = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Period);
  return (
    <Row>
      <DateTime
        {...scopedProps('origin')}
        label="Origin"
        description="Defines where to start counting time buckets from"
        format="MMMM d, yyyy h:mm aa"
        time
      />
      <Input
        {...scopedProps('period')}
        label="Period"
        description="The period in ISO8601 format (e.g. P2W, P3M, PT1H30M, PT0.750S)"
        type="text"
      />
      <Input {...scopedProps('timeZone')} label="Timezone" description="The timezone (e.g. Europe/Paris)" type="text" />
    </Row>
  );
};
Period.type = 'period';
Period.fields = ['origin', 'period', 'timeZone'];

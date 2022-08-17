import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Row } from '../abstract';

export const Time = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Time);
  return (
    <>
      <Row>
        <Input {...scopedProps('timeFormat')} label="Time format" description="the time format" type="text" />
        <Input {...scopedProps('resultFormat')} label="Result format" description="the result format" type="text" />
      </Row>
      <Row>
        <Checkbox {...scopedProps('joda')} label="Joda" description="Specifies if joda format is used." />
      </Row>
    </>
  );
};
Time.type = 'time';
Time.fields = ['timeFormat', 'resultFormat', 'joda'];

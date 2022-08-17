import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const LessThan = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, LessThan);
  return (
    <Row>
      <Input {...scopedProps('aggregation')} label="Aggregation" description="The metric column" type="text" />
      <Input {...scopedProps('value')} label="Value" description="The numeric value" type="number" />
    </Row>
  );
};
LessThan.type = 'lessThan';
LessThan.fields = ['aggregation', 'value'];

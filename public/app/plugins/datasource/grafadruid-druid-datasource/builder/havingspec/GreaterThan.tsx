import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const GreaterThan = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, GreaterThan);
  return (
    <Row>
      <Input {...scopedProps('aggregation')} label="Aggregation" description="The metric column" type="text" />
      <Input {...scopedProps('value')} label="Value" description="The numeric value" type="number" />
    </Row>
  );
};
GreaterThan.type = 'greaterThan';
GreaterThan.fields = ['aggregation', 'value'];

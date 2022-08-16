import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const FinalizingFieldAccess = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, FinalizingFieldAccess);
  return (
    <Row>
      <Input {...scopedProps('name')} label="Name" description="Output name for the value" type="text" />
      <Input {...scopedProps('fieldName')} label="Field name" description="Name of the aggregator" type="text" />
    </Row>
  );
};
FinalizingFieldAccess.type = 'finalizingFieldAccess';
FinalizingFieldAccess.fields = ['name', 'fieldName'];

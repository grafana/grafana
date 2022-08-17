import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const HyperUniqueCardinality = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, HyperUniqueCardinality);
  return (
    <Row>
      <Input {...scopedProps('name')} label="Name" description="Output name for the value" type="text" />
      <Input {...scopedProps('fieldName')} label="Field name" description="Name of the aggregator" type="text" />
    </Row>
  );
};
HyperUniqueCardinality.type = 'hyperUniqueCardinality';
HyperUniqueCardinality.fields = ['name', 'fieldName'];

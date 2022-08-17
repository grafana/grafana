import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';
import { Aggregation } from './';
import { Filter } from '../filter';

export const Filtered = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Filtered);
  return (
    <Row>
      <Input {...scopedProps('name')} label="Name" description="Output name for the summed value" type="text" />
      <Filter {...scopedProps('filter')} />
      <Aggregation {...scopedProps('aggregator')} />
    </Row>
  );
};
Filtered.type = 'filtered';
Filtered.fields = ['name', 'filter', 'aggregator'];
